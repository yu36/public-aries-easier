'use strict';

module.exports = class CreateAriesTask {

	constructor() { }

	/**
	 * const.jsファイルで定義したユーザID/Password情報を取得する
	 */
	setUser() {
		const const_cls = require('./const.js');
		let const_ins = new const_cls;

		this.user_name = const_ins.user_name;
		this.user_pw = const_ins.user_pw;
		this.user_security_token = const_ins.user_security_token;

		this.isTest = const_ins.isTest;
	}

	/**
	 * 処理対象の「開発案件」と、対象年・月を指定する
	 * @param {String} prjName 「開発案件」のNameの前方一致 （ex. 「590-563:チューリッヒ-SIm-アプリケーション保守（2002-2006）」）
	 * @param {Integer} year    対象年（Integer）
	 * @param {Integer} month   対象月（Integer）
	 */
	setTargetProject(prjName, tgtYear, tgtMonth) {
		this.prjName = prjName;
		this.tgtYear = tgtYear;
		this.tgtMonth = tgtMonth;
	}

	/**
	 * メイン処理
	 */
	main() {

		// テスト実行か否かをログ出力する
		if (this.isTest) {
			console.log('Testing ...');
		}

		// jsforceを利用してSalesforce組織DBを走査
		const jsforce = require('jsforce');
		const conn = new jsforce.Connection();

		conn.login(this.user_name, this.user_pw + this.user_security_token, (err, res) => {

			if (err) {
				// エラー時動作
				let errStr = 'ログインエラー';
				console.log(errStr + ': ' + err.message);
				console.log(err.stack);
				throw errStr;
			} else {
				// ログイン後処理呼び出し
				this.doTask(conn);
			}
		});
	}

	/**
	 * 順次処理を管理
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 */
	async doTask(conn) {

		console.log("Executing Task...");

		// 指定取得内容でSELECTし、取得結果JSON文字列を格納
		let prjYotei = await this.selectPrjYotei(conn);

		await this.createTask(conn, prjYotei);
	}

	/**
	 * 「開発案件」に紐付く「予定工数」情報の取得
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 * @returns {Stirng}                JSON形式のQuery取得後オブジェクト文字列
	 */
	async selectPrjYotei(conn) {

		console.log('===== selecting project yotei =====');

		// 対象年・月を元に、yyyy-MM-dd形式（かつ1日）の文字列に変換
		let tgtDate = new Date(Date.UTC(this.tgtYear, this.tgtMonth - 1, 1)); // monthは 0 始まりのため、-1
		let tgtDateStr = tgtDate.toISOString().slice(0, 10);

		let yoteiQuery = 'SELECT Id, KaihatuAnken__c, YouinSei__c, PartnerMember__r.Name, PartnerMember__r.MemberId__c, ResultYM__c, KadoYoteiKosu__c, KaihatuAnken__r.ProjectId__c'
			+ ' FROM YoteiKosu__c '
			+ ` WHERE KaihatuAnken__r.Name LIKE '${this.prjName}%'`
			+ ` AND ResultYM__c = ${tgtDateStr}`
			+ ' ORDER BY PartnerMember__r.Name ASC';

		console.log(yoteiQuery);

		// 予定工数情報を取得
		let result = await conn.query(yoteiQuery);

		console.log(JSON.stringify(result, null, 4));

		return result;
	}

	/**
	 * 「開発案件」に紐付けて「予定工数」分の情報を「タスク」に登録する
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 * @param {Stirng} yoteiJson        JSON形式の予定工数取得結果文字列
	 */
	async createTask(conn, yoteiJson) {

		console.log('===== creating aries task =====');

		// 対象年・月を元に、yyyy-MM-dd形式（かつ1日）の文字列に変換
		let tgtStartDate = new Date(Date.UTC(this.tgtYear, this.tgtMonth - 1, 1)); // monthは 0 始まりのため、-1
		let tgtStartDateStr = tgtStartDate.toISOString().slice(0, 10);

		// 対象月の末日の文字列を作成
		let tgtEndDate = new Date(Date.UTC(this.tgtYear, this.tgtMonth, 0)); // monthは翌月を指す
		let tgtEndDateStr = tgtEndDate.toISOString().slice(0, 10);

		// 紐付け先「WBS」オブジェクトレコードを取得
		let wbsId = await this.getWbsRecId(conn);

		// 設定する「タスク」の「並び順」（Order__c）に設定する初期値
		let orderVal = await this.getTaskMaxOrderVal(conn, wbsId) + 1;

		// 対象WBSに紐付く「タスク」既存レコード全量を取得
		let existTaskJson = await this.getExistTasks(conn, wbsId);
		let existTasks = existTaskJson.records;

		// 「タスク」JSON変数
		let createTasks = [];

		// 受領「予定工数」を元に、作成する「タスク」一覧のJSONを作成する。
		yoteiJson['records'].forEach((value) => {

			// 予定工数1レコード毎、「重複チェック後処理実施可否」結果をリセット
			let shouldContinue = true;

			// 既存レコードで重複が無いか確認する
			existTasks.forEach((existTask) => {

				// 「開発案件」ID 重複チェック
				let isMatchDevPrj = value.KaihatuAnken__c == existTask.DevProjectId__c;

				// 「メンバマスタ」ID 重複チェック
				let isMatchMember = value.PartnerMember__r.MemberId__c == existTask.MemberId__c;

				// 「タスク開始日」ID 重複チェック
				let isMatchStartDay = tgtStartDateStr == existTask.StartDate__c;

				// 対象項目の組み合わせすべてが一致した場合、重複として登録対象から外す
				if (isMatchDevPrj && isMatchMember && isMatchStartDay) {
					// 「重複チェック後処理実施可否」を実施NGに。
					shouldContinue = false;
				}
			});

			// TODO: メンバ名がnullになる場合、エラーを発生させる
			// TODO: プロジェクトメンバ紐付けできない場合、エラーを発生させる

			// 重複ではない場合、登録対象追加処理を実行
			if (shouldContinue) {

				let tempTask = {
					"DevProjectId__c": value.KaihatuAnken__c, // 「開発案件」ID
					"MemberId__c": value.PartnerMember__r.MemberId__c, // 「メンバマスタ」ID
					"StartDate__c": tgtStartDateStr, // 「タスク開始日」
					"EndDate__c": tgtEndDateStr, // 「タスク終了日」
					"PlanManHour__c": value.KadoYoteiKosu__c * 150, // 「予定工数（時間）」
					"TaskName__c": value.YouinSei__c + '_' + value.ResultYM__c.slice(5, 7) + '月', // 「タスク名」
					"WBSId__c": wbsId, // 「WBS」レコード紐付け
					"ProjectId__c": value.KaihatuAnken__r.ProjectId__c, // 「プロジェクト」レコード紐付け
					"Order__c": orderVal // 「並び順」
				};

				createTasks.push(tempTask);

				// 「並び順」を+1
				orderVal++;
			}
		});

		console.log('========== target ' + createTasks.length + ' records ==========');
		console.log(JSON.stringify(createTasks, null, 4));

		// insert後の結果を格納する配列
		let results = [];

		// テスト実行時は動作させない
		if (this.isTest != true) {

			// Insert対象が存在する場合のみ動作させる
			if (createTasks.length > 0) {

				// Aries「タスク」レコードを作成
				results = await conn.sobject("IMP_Task__c").create(createTasks);

				console.log('========== inserted records ==========');
				console.log(JSON.stringify(results, null, 4));
			}

		} else {
			console.log('========== !!!TEST!!! ==========');
		}

		console.log('========== results ==========');
		console.log('insert done: ' + results.length + ' records.');

		return;
	}

	/**
	 * 紐付け先「WBS」レコードIDを取得。
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 * @returns {Stirng}                「WBS」レコードID文字列
	 */
	async getWbsRecId(conn) {

		// 紐付け先「開発案件」レコードIDを取得。
		let projectQuery = 'SELECT ProjectId__c'
			+ ' FROM DevProject__c '
			+ ` WHERE Name LIKE '${this.prjName}%'`
			+ ' LIMIT 1';

		let project = await conn.query(projectQuery);
		let projectId = project.records[0].ProjectId__c;

		// 紐付け先「開発案件」レコードリストを取得。
		let wbsRecQuery = 'SELECT Id'
			+ ' FROM IMP_WBS__c '
			+ ` WHERE ProjectId__c = '${projectId}'`
			+ ' LIMIT 1';

		let wbsRec = await conn.query(wbsRecQuery);
		return wbsRec.records[0].Id;
	}

	/**
	 * 対象WBSに紐付く「タスク」レコードの、最大「並び順」（Order__c）値を取得。
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 * @param {String} wbsId            検査対象タスクの紐付き先WBSレコードID
	 * @returns {Stirng}                「最大「並び順」（Order__c）値
	 */
	async getTaskMaxOrderVal(conn, wbsId) {

		// 紐付け先「開発案件」レコードIDを取得。
		let taskQuery = 'SELECT Order__c'
			+ ' FROM IMP_Task__c '
			+ ` WHERE WBSId__c = '${wbsId}'`
			+ ' ORDER BY Order__c DESC'
			+ ' LIMIT 1';

		let task = await conn.query(taskQuery);
		return task.records[0].Order__c;
	}

	/**
	 * 対象WBSに紐付く「タスク」レコード全量を取得。
	 * @param {jsforce.Connection} conn jsforceライブラリのConnectionインスタンス
	 * @param {String} wbsId            検査対象タスクの紐付き先WBSレコードID
	 * @returns {Stirng}                JSON形式のQuery取得後オブジェクト文字列
	 */
	async getExistTasks(conn, wbsId) {

		// 紐付け先「開発案件」レコードIDを取得。
		let taskQuery = 'SELECT DevProjectId__c, MemberId__c, StartDate__c'
			+ ' FROM IMP_Task__c '
			+ ` WHERE WBSId__c = '${wbsId}'`;

		let tasks = await conn.query(taskQuery);
		return tasks;
	}
}
