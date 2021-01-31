const crat = require('./create_aries_task');
let crat_ins = new crat();
crat_ins.setUser(); // ユーザログイン情報設定
crat_ins.setTargetProject('637-992', 2021, 1); // 処理対象「開発案件」をName前方一致で指定
crat_ins.main(); 