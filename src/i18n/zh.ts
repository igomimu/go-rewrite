// GORewrite i18n - Chinese (Simplified) translations

import { TranslationKey } from './ja';

export const zh: Record<TranslationKey, string> = {
    // === App.tsx ===
    // Alerts
    'alert.saved': '已保存: {path}',
    'alert.pass': '虚手 (跳过)',
    'alert.pasteNoSGF': '剪贴板中没有SGF',
    'alert.pasteError': '粘贴错误',
    'alert.copiedToClipboard': '已复制到剪贴板',

    // Tooltips - File Operations
    'tooltip.new': '新建 / 清除 (Alt+N)',
    'tooltip.open': '打开SGF (Ctrl+O)',
    'tooltip.save': '覆盖保存',
    'tooltip.saveAs': '另存为... (Ctrl+S)',
    'tooltip.paste': '从剪贴板粘贴SGF',
    'tooltip.gameInfo': '棋局信息',

    // Tooltips - View & Tools
    'tooltip.print': '打印 (Ctrl+P)',
    'tooltip.showCaptured': '导出时显示被吃的子: {status}',
    'tooltip.showNumbers': '显示手数: {status}',
    'tooltip.pass': '虚手',

    // Tooltips - Export
    'tooltip.copyAs': '复制为{format} (点击复制)',
    'tooltip.savePng': '保存为PNG...',
    'tooltip.toggleFormat': '切换导出格式 (SVG/PNG)',

    // Tooltips - System
    'tooltip.openNewTab': '在新标签页打开 (最大化)',
    'tooltip.help': '帮助',

    // Tooltips - Board Controls
    'tooltip.monochrome': '切换黑白模式 (打印友好)',
    'tooltip.copySelection': '复制选区',
    'tooltip.cropSelection': '裁剪到选区',
    'tooltip.resetView': '重置视图 (Esc)',
    'tooltip.placeBlack': '放置黑子 (布局模式)',
    'tooltip.placeWhite': '放置白子 (布局模式)',
    'tooltip.numberedMode': '编号模式 (点击切换颜色: {color})',
    'tooltip.labelMode': '标签模式 (A, B, C...)',
    'tooltip.symbolMode': '符号模式',

    // Tooltips - Navigation
    'tooltip.deleteMove': '删除最后一手 (Delete/Ctrl+Z)',
    'tooltip.restoreMove': '恢复删除的手 (Ctrl+Y)',
    'tooltip.firstMove': '第一手 (Home)',
    'tooltip.back10': '后退10手',
    'tooltip.back': '后退 (滚轮上)',
    'tooltip.forward': '前进 (滚轮下)',
    'tooltip.forward10': '前进10手',
    'tooltip.lastMove': '最后一手 (End)',
    'tooltip.branch': '分支 {value} ({x},{y})',

    // UI Text
    'ui.dropFileHere': '将SGF文件拖放到此处',
    'ui.on': '开',
    'ui.off': '关',
    'ui.black': '黑',
    'ui.white': '白',
    'ui.color': '彩色',
    'ui.monochrome': '黑白',
    'ui.branch': '分支',

    // Help Modal
    'help.title': '快捷键 & 帮助',
    'help.clickRightClick': '点击 / 右键点击',
    'help.clickDesc': '放置 / 删除棋子',
    'help.drag': '拖动',
    'help.dragDesc': '选区 (裁剪) / 移动棋子',
    'help.wheel': '滚轮',
    'help.wheelDesc': '撤销 / 重做',
    'help.copy': '复制',
    'help.copyDesc': '复制图像到剪贴板',
    'help.sgfPaste': '粘贴SGF',
    'help.sgfPasteDesc': '从剪贴板加载棋谱',

    // === GameInfoModal.tsx ===
    'gameInfo.title': '棋局信息',
    'gameInfo.basicInfo': '基本信息',
    'gameInfo.gameName': '棋局名称',
    'gameInfo.white': '白方',
    'gameInfo.black': '黑方',
    'gameInfo.whiteRank': '白方段位',
    'gameInfo.blackRank': '黑方段位',
    'gameInfo.whiteTeam': '白方队伍',
    'gameInfo.blackTeam': '黑方队伍',
    'gameInfo.komi': '贴目',
    'gameInfo.handicap': '让子',
    'gameInfo.result': '结果',
    'gameInfo.datePlace': '日期与地点',
    'gameInfo.date': '日期',
    'gameInfo.place': '地点',
    'gameInfo.time': '时间',
    'gameInfo.round': '回合',
    'gameInfo.event': '赛事',
    'gameInfo.other': '其他',
    'gameInfo.recorder': '记录者',
    'gameInfo.source': '来源',
    'gameInfo.comment': '评论',
    'gameInfo.copyright': '版权',
    'gameInfo.annotation': '注解',
    'gameInfo.ok': '确定',
    'gameInfo.cancel': '取消',

    // === PrintSettingsModal.tsx ===
    'print.title': '打印设置',
    'print.pageSettings': '页面设置',
    'print.currentBoard': '打印当前棋盘',
    'print.wholeFileMoves': '整局棋谱 (按手数分割)',
    'print.wholeFileFigure': '整局棋谱 (固定每图手数)',
    'print.movesPerFigure': '每图手数',
    'print.options': '选项',
    'print.showMarkers': '显示标记',
    'print.showMoveNumber': '显示手数',
    'print.showCoordinate': '显示坐标',
    'print.monochromeMode': '黑白模式',
    'print.figuresPerPage': '图/页',
    'print.titleLabel': '标题',
    'print.subTitle': '副标题',
    'print.header': '页眉',
    'print.footer': '页脚',
    'print.display': '显示',
    'print.everyPage': '每页',
    'print.firstPageOnly': '仅首页',
    'print.insertVariable': '插入变量 (点击): 到{target}',
    'print.clear': '清除',
    'print.resetDefault': '恢复默认',
    'print.cancel': '取消',
    'print.preview': '预览',
    'print.showHide': '显示/隐藏',

    // Variable labels
    'print.var.name': '名称',
    'print.var.date': '日期',
    'print.var.place': '地点',
    'print.var.result': '结果',
    'print.var.black': '黑方',
    'print.var.blackName': '黑(名)',
    'print.var.blackRank': '黑段',
    'print.var.komi': '贴目',
    'print.var.white': '白方',
    'print.var.whiteName': '白(名)',
    'print.var.whiteRank': '白段',
    'print.var.komiL': '贴目L',
    'print.var.time': '时间',
    'print.var.page': '页',
};
