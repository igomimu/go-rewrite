// GORewrite i18n - English translations

import { TranslationKey } from './ja';

export const en: Record<TranslationKey, string> = {
    // === App.tsx ===
    // Alerts
    'alert.saved': 'Saved: {path}',
    'alert.pass': 'Pass (Skip turn)',
    'alert.pasteNoSGF': 'No SGF in clipboard',
    'alert.pasteError': 'Paste error',
    'alert.copiedToClipboard': 'Copied to clipboard',

    // Tooltips - File Operations
    'tooltip.new': 'New / Clear (Alt+N)',
    'tooltip.open': 'Open SGF (Ctrl+O)',
    'tooltip.save': 'Overwrite Save',
    'tooltip.saveAs': 'Save As... (Ctrl+S)',
    'tooltip.paste': 'Paste SGF from Clipboard',
    'tooltip.gameInfo': 'Game Info',

    // Tooltips - View & Tools
    'tooltip.print': 'Print (Ctrl+P)',
    'tooltip.showCaptured': 'Show Captured Stones in Export: {status}',
    'tooltip.showNumbers': 'Show Move Numbers: {status}',
    'tooltip.pass': 'Pass',

    // Tooltips - Export
    'tooltip.copyAs': 'Copy as {format} (Click to Copy)',
    'tooltip.savePng': 'Save as PNG...',
    'tooltip.exportGif': 'Save as Animated GIF...',
    'tooltip.toggleFormat': 'Toggle export format (SVG/PNG)',

    // Tooltips - System
    'tooltip.openNewTab': 'Open in New Tab (Maximize)',
    'tooltip.help': 'Help',

    // Tooltips - Board Controls
    'tooltip.monochrome': 'Toggle Monochrome (Printer Friendly)',
    'tooltip.copySelection': 'Copy Selection',
    'tooltip.cropSelection': 'Crop to Selection',
    'tooltip.resetView': 'Reset View (Esc)',
    'tooltip.placeBlack': 'Place Black Stone (Simple Mode)',
    'tooltip.placeWhite': 'Place White Stone (Simple Mode)',
    'tooltip.numberedMode': 'Numbered Mode (Click to toggle color: {color})',
    'tooltip.labelMode': 'Label Mode (A, B, C...)',
    'tooltip.symbolMode': 'Symbol Mode',

    // Tooltips - Navigation
    'tooltip.deleteMove': 'Delete Last Move (Delete/Ctrl+Z)',
    'tooltip.restoreMove': 'Restore Deleted Move (Ctrl+Y)',
    'tooltip.firstMove': 'First Move (Home)',
    'tooltip.back10': 'Back 10 Moves',
    'tooltip.back': 'Back (Wheel Up)',
    'tooltip.forward': 'Forward (Wheel Down)',
    'tooltip.forward10': 'Forward 10 Moves',
    'tooltip.lastMove': 'Last Move (End)',
    'tooltip.branch': 'Branch {value} ({x},{y})',

    // UI Text
    'ui.dropFileHere': 'Drop SGF File Here',
    'ui.on': 'ON',
    'ui.off': 'OFF',
    'ui.black': 'Black',
    'ui.white': 'White',
    'ui.color': 'Color',
    'ui.monochrome': 'Monochrome',
    'ui.branch': 'Branch',
    'ui.exportingGif': 'Creating GIF...',

    // Help Modal
    'help.title': 'Shortcuts & Help',
    'help.clickRightClick': 'Click / Right-Click',
    'help.clickDesc': 'Place / Remove stone',
    'help.drag': 'Drag',
    'help.dragDesc': 'Selection (Crop) / Move stone',
    'help.wheel': 'Wheel',
    'help.wheelDesc': 'Undo / Redo',
    'help.copy': 'Copy',
    'help.copyDesc': 'Copy image to clipboard',
    'help.sgfPaste': 'Paste SGF',
    'help.sgfPasteDesc': 'Load game record from clipboard',

    // === GameInfoModal.tsx ===
    'gameInfo.title': 'Game Info',
    'gameInfo.basicInfo': 'Basic Info',
    'gameInfo.gameName': 'Game Name',
    'gameInfo.white': 'White',
    'gameInfo.black': 'Black',
    'gameInfo.whiteRank': 'White Rank',
    'gameInfo.blackRank': 'Black Rank',
    'gameInfo.whiteTeam': 'White Team',
    'gameInfo.blackTeam': 'Black Team',
    'gameInfo.komi': 'Komi',
    'gameInfo.handicap': 'Handicap',
    'gameInfo.result': 'Result',
    'gameInfo.datePlace': 'Date & Place',
    'gameInfo.date': 'Date',
    'gameInfo.place': 'Place',
    'gameInfo.time': 'Time',
    'gameInfo.round': 'Round',
    'gameInfo.event': 'Event',
    'gameInfo.other': 'Other',
    'gameInfo.recorder': 'Recorder',
    'gameInfo.source': 'Source',
    'gameInfo.comment': 'Comment',
    'gameInfo.copyright': 'Copyright',
    'gameInfo.annotation': 'Annotation',
    'gameInfo.ok': 'OK',
    'gameInfo.cancel': 'Cancel',

    // === PrintSettingsModal.tsx ===
    'print.title': 'Print Settings',
    'print.pageSettings': 'Page Settings',
    'print.currentBoard': 'Print Current Board',
    'print.wholeFileMoves': 'Whole Game (Split by moves)',
    'print.wholeFileFigure': 'Whole Game (Fixed moves per figure)',
    'print.movesPerFigure': 'Moves per Figure',
    'print.options': 'Options',
    'print.showMarkers': 'Show Markers',
    'print.showMoveNumber': 'Show Move Numbers',
    'print.showCoordinate': 'Show Coordinates',
    'print.monochromeMode': 'Monochrome Mode',
    'print.figuresPerPage': 'Figures/Page',
    'print.titleLabel': 'Title',
    'print.subTitle': 'Subtitle',
    'print.header': 'Header',
    'print.footer': 'Footer',
    'print.display': 'Display',
    'print.everyPage': 'Every Page',
    'print.firstPageOnly': 'First Page Only',
    'print.insertVariable': 'Insert variable (click): to {target}',
    'print.clear': 'Clear',
    'print.resetDefault': 'Reset to Default',
    'print.cancel': 'Cancel',
    'print.preview': 'Preview',
    'print.showHide': 'Show/Hide',

    'print.layout': 'Layout',
    'print.layout1col': '1 Column (Vertical)',
    'print.layout2col': '2 Columns (Grid)',
    'print.layoutAuto': 'Auto',

    // Variable labels
    'print.var.name': 'Name',
    'print.var.date': 'Date',
    'print.var.place': 'Place',
    'print.var.result': 'Result',
    'print.var.black': 'Black',
    'print.var.blackName': 'Black(N)',
    'print.var.blackRank': 'B.Rank',
    'print.var.komi': 'Komi',
    'print.var.white': 'White',
    'print.var.whiteName': 'White(N)',
    'print.var.whiteRank': 'W.Rank',
    'print.var.komiL': 'KomiL',
    'print.var.time': 'Time',
    'print.var.page': 'Page',
};
