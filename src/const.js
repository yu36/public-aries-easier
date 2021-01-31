module.exports = class ConstVal {
	constructor() {
		// TODO: OAuth化したい
		this.user_name = 'you@example.com';
		this.user_pw = 'password';
		this.user_security_token = 'XXXXXXXXXXXXXXXXXXXXXXXXX'; // パスワード初期化時に発行。信頼済みIPの場合不要

		this.isTest = false; // trueの場合、Insert処理など、DBに影響が出る処理を実施しない
	}
}