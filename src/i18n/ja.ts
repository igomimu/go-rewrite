// GORewrite i18n - Japanese translations (default)

export const ja = {
    // === App.tsx ===
    // Alerts
    'alert.saved': '保存しました: {path}',
    'alert.pass': 'パス (手番スキップ)',
    'alert.pasteNoSGF': 'クリップボードにSGFがありません',
    'alert.pasteError': '貼り付けエラー',
    'alert.copiedToClipboard': 'クリップボードにコピーしました',

    // Tooltips - File Operations
    'tooltip.new': '新規 / クリア (Alt+N)',
    'tooltip.open': 'SGFを開く (Ctrl+O)',
    'tooltip.save': '上書き保存',
    'tooltip.saveAs': '名前を付けて保存... (Ctrl+S)',
    'tooltip.paste': 'クリップボードからSGFを貼り付け',
    'tooltip.gameInfo': '対局情報',

    // Tooltips - View & Tools
    'tooltip.print': '印刷 (Ctrl+P)',
    'tooltip.showCaptured': 'エクスポート時に取られた石を表示: {status}',
    'tooltip.showNumbers': '手番号表示: {status}',
    'tooltip.pass': 'パス',

    // Tooltips - Export
    'tooltip.copyAs': '{format}としてコピー (クリックでコピー)',
    'tooltip.savePng': 'PNGとして保存...',
    'tooltip.exportGif': 'GIFアニメーションとして保存...',
    'tooltip.toggleFormat': 'エクスポート形式を切り替え (SVG/PNG)',

    // Tooltips - System
    'tooltip.openNewTab': '新しいタブで開く (最大化)',
    'tooltip.help': 'ヘルプ',

    // Tooltips - Board Controls
    'tooltip.monochrome': 'モノクロ切り替え (印刷用)',
    'tooltip.copySelection': '選択範囲をコピー',
    'tooltip.cropSelection': '選択範囲で切り抜き',
    'tooltip.resetView': '表示をリセット (Esc)',
    'tooltip.placeBlack': '黒石を置く (配置モード)',
    'tooltip.placeWhite': '白石を置く (配置モード)',
    'tooltip.numberedMode': '手番モード (クリックで色切替: {color})',
    'tooltip.labelMode': 'ラベルモード (A, B, C...)',
    'tooltip.symbolMode': 'シンボルモード',

    // Tooltips - Navigation
    'tooltip.deleteMove': '最後の手を削除 (Delete/Ctrl+Z)',
    'tooltip.restoreMove': '削除した手を復元 (Ctrl+Y)',
    'tooltip.firstMove': '最初の手 (Home)',
    'tooltip.back10': '10手戻る',
    'tooltip.back': '戻る (ホイール上)',
    'tooltip.forward': '進む (ホイール下)',
    'tooltip.forward10': '10手進む',
    'tooltip.lastMove': '最後の手 (End)',
    'tooltip.branch': '分岐 {value} ({x},{y})',

    // UI Text
    'ui.dropFileHere': 'SGFファイルをここにドロップ',
    'ui.on': 'ON',
    'ui.off': 'OFF',
    'ui.black': '黒',
    'ui.white': '白',
    'ui.color': 'カラー',
    'ui.monochrome': '白黒',
    'ui.branch': '分岐',
    'ui.exportingGif': 'GIF生成中...',

    // Help Modal
    'help.title': 'ショートカット & ヘルプ',
    'help.clickRightClick': 'クリック / 右クリック',
    'help.clickDesc': '石を置く / 削除',
    'help.drag': 'ドラッグ',
    'help.dragDesc': '範囲選択 (切り抜き) / 石の移動',
    'help.wheel': 'ホイール',
    'help.wheelDesc': 'アンドゥ(戻る) / リドゥ(進む)',
    'help.copy': 'コピー',
    'help.copyDesc': '画像をクリップボードに保存',
    'help.sgfPaste': 'SGF貼り付け',
    'help.sgfPasteDesc': 'クリップボードから棋譜を読み込み',

    // === GameInfoModal.tsx ===
    'gameInfo.title': '対局情報',
    'gameInfo.basicInfo': '基本情報',
    'gameInfo.gameName': '対局名称',
    'gameInfo.white': '白番',
    'gameInfo.black': '黒番',
    'gameInfo.whiteRank': '白番ランク',
    'gameInfo.blackRank': '黒番ランク',
    'gameInfo.whiteTeam': '白番チーム',
    'gameInfo.blackTeam': '黒番チーム',
    'gameInfo.komi': 'コミ',
    'gameInfo.handicap': '置き石',
    'gameInfo.result': '結果',
    'gameInfo.datePlace': '日時・場所',
    'gameInfo.date': '日付',
    'gameInfo.place': '場所',
    'gameInfo.time': '時間',
    'gameInfo.round': '回戦',
    'gameInfo.event': 'イベント',
    'gameInfo.other': 'その他',
    'gameInfo.recorder': '記録者',
    'gameInfo.source': '情報源',
    'gameInfo.comment': 'コメント',
    'gameInfo.copyright': '著作権',
    'gameInfo.annotation': '注釈',
    'gameInfo.ok': 'OK',
    'gameInfo.cancel': 'キャンセル',

    // === PrintSettingsModal.tsx ===
    'print.title': '印刷設定',
    'print.pageSettings': 'ページ設定',
    'print.currentBoard': '現在の盤面を印刷',
    'print.wholeFileMoves': '棋譜全体 ("設定手数"で譜分け)',
    'print.wholeFileFigure': '棋譜全体 (手数指定で譜分け)',
    'print.movesPerFigure': '1図あたりの手数',
    'print.options': 'オプション',
    'print.showMarkers': 'マーカーを表示',
    'print.showMoveNumber': '手数を表示',
    'print.showCoordinate': '座標を表示',
    'print.monochromeMode': '白黒モード',
    'print.figuresPerPage': '図/ページ',
    'print.titleLabel': 'タイトル',
    'print.subTitle': '副題',
    'print.header': 'ヘッダー',
    'print.footer': 'フッター',
    'print.display': '表示',
    'print.everyPage': '全ページ',
    'print.firstPageOnly': '最初のページのみ',
    'print.insertVariable': '変数を挿入 (クリック): {target}へ',
    'print.clear': 'クリア',
    'print.resetDefault': 'デフォルトに戻す',
    'print.cancel': 'キャンセル',
    'print.preview': 'プレビュー',
    'print.showHide': '表示/非表示',

    'print.layout': '配置',
    'print.layout1col': '1列 (縦並び)',
    'print.layout2col': '2列 (グリッド)',
    'print.layoutAuto': '自動',

    // Variable labels
    'print.var.name': '名前',
    'print.var.date': '日付',
    'print.var.place': '場所',
    'print.var.result': '結果',
    'print.var.black': '黒番',
    'print.var.blackName': '黒(名)',
    'print.var.blackRank': '黒段',
    'print.var.komi': 'コミ',
    'print.var.white': '白番',
    'print.var.whiteName': '白(名)',
    'print.var.whiteRank': '白段',
    'print.var.komiL': 'コミL',
    'print.var.time': '時間',
    'print.var.page': '頁',
} as const;

export type TranslationKey = keyof typeof ja;
