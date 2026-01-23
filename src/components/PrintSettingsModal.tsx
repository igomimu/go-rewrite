import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';

export interface PrintSettings {
    pagingType: 'CURRENT' | 'WHOLE_FILE_MOVE' | 'WHOLE_FILE_FIGURE';
    movesPerFigure: number;
    showMarkers: boolean;
    showMoveNumber: boolean;
    showCoordinate: boolean;
    figuresPerPage: number;
    title: string;
    showTitle: boolean;
    subTitle: string;
    showSubTitle: boolean;
    header: string;
    showHeader: boolean;
    headerFrequency: 'EVERY_PAGE' | 'FIRST_PAGE_ONLY';
    footer: string;
    showFooter: boolean;
    colorMode: 'COLOR' | 'MONOCHROME';
    layout: 'AUTO' | '1COL' | '2COL';
}

export const DEFAULT_SETTINGS: PrintSettings = {
    pagingType: 'CURRENT',
    movesPerFigure: 50,
    showMarkers: false,
    showMoveNumber: true,
    showCoordinate: false,
    figuresPerPage: 4,
    title: '%GN%',
    showTitle: true,
    subTitle: '%DT%  %PC%  %RE%',
    showSubTitle: true,
    header: '%GN% Page %PAGE%',
    showHeader: true,
    headerFrequency: 'EVERY_PAGE',
    footer: '',
    showFooter: true,
    colorMode: 'COLOR',
    layout: 'AUTO'
};

interface PrintSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: (settings: PrintSettings) => void;
    initialSettings?: PrintSettings;
}

const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({ isOpen, onClose, onPrint, initialSettings }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
    const [lastFocusedInput, setLastFocusedInput] = useState<keyof Pick<PrintSettings, 'title' | 'subTitle' | 'header' | 'footer'>>('title');

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('gorw_print_settings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setSettings({ ...DEFAULT_SETTINGS, ...parsed });
                } catch (e) {
                    console.error('Failed to load print settings', e);
                    setSettings(DEFAULT_SETTINGS);
                }
            } else if (initialSettings) {
                setSettings({ ...DEFAULT_SETTINGS, ...initialSettings });
            }
        }
    }, [isOpen, initialSettings]);

    if (!isOpen) return null;

    const handleChange = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handlePrint = () => {
        localStorage.setItem('gorw_print_settings', JSON.stringify(settings));
        onPrint(settings);
    };

    const insertVariable = (variable: string) => {
        setSettings(prev => ({
            ...prev,
            [lastFocusedInput]: (prev[lastFocusedInput] || '') + variable
        }));
    };

    const getTargetLabel = () => {
        switch (lastFocusedInput) {
            case 'title': return t('print.titleLabel');
            case 'subTitle': return t('print.subTitle');
            case 'header': return t('print.header');
            case 'footer': return t('print.footer');
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 font-sans text-sm isolate print:hidden" onClick={onClose}>
            <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-sm border border-gray-400" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-2 border-b border-gray-300 bg-gray-200 rounded-t-lg">
                    <span className="font-normal text-gray-800">{t('print.title')}</span>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-lg leading-none">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Paging Type */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-3">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">{t('print.pageSettings')}</span>
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'CURRENT'}
                                    onChange={() => handleChange('pagingType', 'CURRENT')} />
                                <span>{t('print.currentBoard')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'WHOLE_FILE_MOVE'}
                                    onChange={() => handleChange('pagingType', 'WHOLE_FILE_MOVE')} />
                                <span>{t('print.wholeFileMoves')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="pagingType" checked={settings.pagingType === 'WHOLE_FILE_FIGURE'}
                                    onChange={() => handleChange('pagingType', 'WHOLE_FILE_FIGURE')} />
                                <span>{t('print.wholeFileFigure')}</span>
                            </label>
                            <div className="pl-6 flex items-center gap-2 mt-1">
                                <span className={settings.pagingType !== 'WHOLE_FILE_FIGURE' ? 'text-gray-400' : ''}>{t('print.movesPerFigure')}</span>
                                <input type="number" className="w-16 border px-1 py-0.5"
                                    value={settings.movesPerFigure}
                                    aria-label={t('print.movesPerFigure')}
                                    disabled={settings.pagingType !== 'WHOLE_FILE_FIGURE'}
                                    onChange={e => handleChange('movesPerFigure', parseInt(e.target.value) || 50)} />
                            </div>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-3">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">{t('print.options')}</span>
                        <div className="space-y-1 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showMarkers}
                                    onChange={e => handleChange('showMarkers', e.target.checked)} />
                                <span className="text-xs">{t('print.showMarkers')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showMoveNumber}
                                    onChange={e => handleChange('showMoveNumber', e.target.checked)} />
                                <span className="text-xs">{t('print.showMoveNumber')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.showCoordinate}
                                    onChange={e => handleChange('showCoordinate', e.target.checked)} />
                                <span className="text-xs">{t('print.showCoordinate')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.colorMode === 'MONOCHROME'}
                                    onChange={e => handleChange('colorMode', e.target.checked ? 'MONOCHROME' : 'COLOR')} />
                                <span className="text-xs">{t('print.monochromeMode')}</span>
                            </label>
                        </div>

                        <div className="flex justify-between items-center mb-2 gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs">{t('print.figuresPerPage')}</span>
                                <input type="number" className="w-12 border px-1 py-0.5 text-xs"
                                    aria-label={t('print.figuresPerPage')}
                                    value={settings.figuresPerPage} onChange={e => handleChange('figuresPerPage', parseInt(e.target.value) || 4)} />
                            </div>

                            {/* Layout Selection */}
                            <div className="flex items-center gap-1">
                                <span className="text-xs">{t('print.layout')}</span>
                                <select
                                    className="border border-gray-400 px-1 py-0.5 text-xs w-24"
                                    value={settings.layout || 'AUTO'}
                                    onChange={e => handleChange('layout', e.target.value as any)}
                                >
                                    <option value="AUTO">{t('print.layoutAuto') || 'Auto'}</option>
                                    <option value="1COL">{t('print.layout1col')}</option>
                                    <option value="2COL">{t('print.layout2col')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                                <label className="w-14">{t('print.titleLabel')}</label>
                                <input
                                    className={`border px-1 w-full outline-none transition-all ${lastFocusedInput === 'title' ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-400 focus:border-blue-400'}`}
                                    value={settings.title}
                                    onChange={e => handleChange('title', e.target.value)}
                                    onFocus={() => setLastFocusedInput('title')}
                                    disabled={!settings.showTitle}
                                />
                                <input type="checkbox" checked={settings.showTitle} onChange={e => handleChange('showTitle', e.target.checked)} title={t('print.showHide')} />
                            </div>

                            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                                <label className="w-14">{t('print.subTitle')}</label>
                                <input
                                    className={`border px-1 w-full outline-none transition-all ${lastFocusedInput === 'subTitle' ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-400 focus:border-blue-400'}`}
                                    value={settings.subTitle}
                                    onChange={e => handleChange('subTitle', e.target.value)}
                                    onFocus={() => setLastFocusedInput('subTitle')}
                                    disabled={!settings.showSubTitle}
                                />
                                <input type="checkbox" checked={settings.showSubTitle} onChange={e => handleChange('showSubTitle', e.target.checked)} title={t('print.showHide')} />
                            </div>

                            {/* Variable Insertion Help */}
                            <div className="border border-gray-300 rounded p-1.5 bg-gray-50 text-[10px] text-gray-500 leading-tight">
                                <div className="mb-1 font-bold flex justify-between">
                                    <span>{t('print.insertVariable', { target: getTargetLabel() })}</span>
                                    <button onClick={() => setSettings(prev => ({ ...prev, [lastFocusedInput]: '' }))} className="text-red-500 hover:underline">{t('print.clear')}</button>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {[
                                        { l: t('print.var.name'), v: '%GN%' }, { l: t('print.var.date'), v: '%DT%' }, { l: t('print.var.place'), v: '%PC%' }, { l: t('print.var.result'), v: '%RE%' },
                                        { l: t('print.var.black'), v: '%PB%' }, { l: t('print.var.blackName'), v: '%PBL%' }, { l: t('print.var.blackRank'), v: '%BR%' }, { l: t('print.var.komi'), v: '%KM%' },
                                        { l: t('print.var.white'), v: '%PW%' }, { l: t('print.var.whiteName'), v: '%PWL%' }, { l: t('print.var.whiteRank'), v: '%WR%' }, { l: t('print.var.komiL'), v: '%KML%' },
                                        { l: t('print.var.time'), v: '%TM%' }, { l: t('print.var.page'), v: '%PAGE%' }
                                    ].map(item => (
                                        <button key={item.v} onClick={() => insertVariable(item.v)}
                                            className="bg-white border rounded px-1 hover:bg-gray-200 text-center shadow-sm active:bg-blue-100 transition-colors"
                                            title={item.l}>
                                            {item.v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                                <label className="w-14">{t('print.header')}</label>
                                <input
                                    className={`border px-1 w-full outline-none transition-all ${lastFocusedInput === 'header' ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-400 focus:border-blue-400'}`}
                                    value={settings.header}
                                    onChange={e => handleChange('header', e.target.value)}
                                    onFocus={() => setLastFocusedInput('header')}
                                    disabled={!settings.showHeader}
                                />
                                <input type="checkbox" checked={settings.showHeader} onChange={e => handleChange('showHeader', e.target.checked)} title={t('print.showHide')} />
                            </div>

                            {/* Header Frequency */}
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <label className="w-14">{t('print.display')}</label>
                                <select
                                    className="border border-gray-400 px-1 w-full"
                                    value={settings.headerFrequency}
                                    aria-label={t('print.display')}
                                    onChange={e => handleChange('headerFrequency', e.target.value as any)}
                                    disabled={!settings.showHeader}
                                >
                                    <option value="EVERY_PAGE">{t('print.everyPage')}</option>
                                    <option value="FIRST_PAGE_ONLY">{t('print.firstPageOnly')}</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                                <label className="w-14">{t('print.footer')}</label>
                                <input
                                    className={`border px-1 w-full outline-none transition-all ${lastFocusedInput === 'footer' ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-400 focus:border-blue-400'}`}
                                    value={settings.footer}
                                    onChange={e => handleChange('footer', e.target.value)}
                                    onFocus={() => setLastFocusedInput('footer')}
                                    disabled={!settings.showFooter}
                                />
                                <input type="checkbox" checked={settings.showFooter} onChange={e => handleChange('showFooter', e.target.checked)} title={t('print.showHide')} />
                            </div>
                        </div>

                        <div className="flex justify-end mt-2">
                            <button className="px-3 py-1 bg-white border border-gray-400 rounded hover:bg-gray-100 text-xs shadow-sm"
                                onClick={() => setSettings(DEFAULT_SETTINGS)}>
                                {t('print.resetDefault')}
                            </button>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="p-3 border-t border-gray-300 bg-gray-200 rounded-b-lg flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-white text-gray-700 rounded border border-gray-400 hover:bg-gray-50 shadow-sm">
                            {t('print.cancel')}
                        </button>
                        <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2">
                            <span>🖨️</span> {t('print.preview')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintSettingsModal;
