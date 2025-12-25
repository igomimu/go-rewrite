import React, { useState, useEffect } from 'react';

export interface PrintSettings {
    pagingType: 'CURRENT' | 'WHOLE_FILE_MOVE' | 'WHOLE_FILE_FIGURE';
    movesPerFigure: number;
    showMarkers: boolean;
    showMoveNumber: boolean;
    showCoordinate: boolean;
    figuresPerPage: number;
    title: string;
    subTitle: string;
    header: string;
    footer: string;
}

interface PrintSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: (settings: PrintSettings) => void;
    initialSettings?: Partial<PrintSettings>;
}

const DEFAULT_SETTINGS: PrintSettings = {
    pagingType: 'CURRENT',
    movesPerFigure: 50,
    showMarkers: false,
    showMoveNumber: true,
    showCoordinate: false,
    figuresPerPage: 4,
    title: '%GN% %PW% %WR%(W) vs %PB% %BR%(B)',
    subTitle: '%DT% %PC% %RE%',
    header: '%GN% %PW% %WR%(W) vs %PB% %BR%(B) Page %PAGE%',
    footer: ''
};

const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({ isOpen, onClose, onPrint, initialSettings }) => {
    const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        if (isOpen && initialSettings) {
            setSettings(prev => ({ ...prev, ...initialSettings }));
        }
    }, [isOpen, initialSettings]);

    useEffect(() => {
        console.log('PrintSettingsModal rendered, isOpen:', isOpen);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 font-sans text-sm isolate" onClick={onClose}>
            <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-sm border border-gray-400" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-2 border-b border-gray-300 bg-gray-200 rounded-t-lg">
                    <span className="font-normal text-gray-800">印刷設定</span>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-lg leading-none">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Paging Type */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-3">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">ページ設定</span>
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'CURRENT'}
                                    onChange={() => handleChange('pagingType', 'CURRENT')} />
                                <span>現在の盤面を印刷</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-gray-500">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'WHOLE_FILE_MOVE'} disabled
                                    onChange={() => handleChange('pagingType', 'WHOLE_FILE_MOVE')} />
                                <span>棋譜全体 ("設定手数"で分割) (未実装)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'WHOLE_FILE_FIGURE'}
                                    onChange={() => handleChange('pagingType', 'WHOLE_FILE_FIGURE')} />
                                <span>棋譜全体 (手数指定で分割)</span>
                            </label>
                            <div className="pl-6 flex items-center gap-2 mt-1">
                                <span className={settings.pagingType !== 'WHOLE_FILE_FIGURE' ? 'text-gray-400' : ''}>1図あたりの手数</span>
                                <input type="number" className="w-16 border px-1 py-0.5"
                                    value={settings.movesPerFigure}
                                    disabled={settings.pagingType !== 'WHOLE_FILE_FIGURE'}
                                    onChange={e => handleChange('movesPerFigure', parseInt(e.target.value) || 50)} />
                            </div>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-3">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">オプション</span>
                        <div className="space-y-1 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showMarkers}
                                    onChange={e => handleChange('showMarkers', e.target.checked)} />
                                <span>マーカーを表示</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showMoveNumber}
                                    onChange={e => handleChange('showMoveNumber', e.target.checked)} />
                                <span>手数を表示</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showCoordinate}
                                    onChange={e => handleChange('showCoordinate', e.target.checked)} />
                                <span>座標を表示</span>
                            </label>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <span>1ページあたりの図数</span>
                            <input type="number" className="w-16 border px-1 py-0.5"
                                value={settings.figuresPerPage} onChange={e => handleChange('figuresPerPage', parseInt(e.target.value) || 4)} />
                        </div>

                        <div className="space-y-2">
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <label className="w-16">タイトル</label>
                                <input className="border border-gray-400 px-1 w-full" value={settings.title} onChange={e => handleChange('title', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <label className="w-16">サブタイトル</label>
                                <input className="border border-gray-400 px-1 w-full" value={settings.subTitle} onChange={e => handleChange('subTitle', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <label className="w-16">ヘッダー</label>
                                <input className="border border-gray-400 px-1 w-full" value={settings.header} onChange={e => handleChange('header', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <label className="w-16">フッター</label>
                                <input className="border border-gray-400 px-1 w-full" value={settings.footer} onChange={e => handleChange('footer', e.target.value)} />
                            </div>
                        </div>

                        <div className="flex justify-end mt-2">
                            <button className="px-3 py-1 bg-white border border-gray-400 rounded hover:bg-gray-100 text-xs shadow-sm"
                                onClick={() => setSettings(DEFAULT_SETTINGS)}>
                                デフォルトに戻す
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3 border-t border-gray-300 bg-gray-200 rounded-b-lg flex justify-end gap-2">
                    <button onClick={() => onPrint(settings)} className="px-6 py-1.5 bg-white border border-blue-500 text-blue-600 rounded hover:bg-blue-50 shadow-sm w-24 font-bold">
                        印刷
                    </button>
                    <button onClick={onClose} className="px-6 py-1.5 bg-white border border-gray-400 rounded hover:bg-gray-50 text-black shadow-sm w-24">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintSettingsModal;
