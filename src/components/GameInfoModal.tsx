import React from 'react';

interface GameInfoModalProps {
    onClose: () => void;
    blackName: string; setBlackName: (v: string) => void;
    blackRank: string; setBlackRank: (v: string) => void;
    blackTeam: string; setBlackTeam: (v: string) => void;
    whiteName: string; setWhiteName: (v: string) => void;
    whiteRank: string; setWhiteRank: (v: string) => void;
    whiteTeam: string; setWhiteTeam: (v: string) => void;
    komi: string; setKomi: (v: string) => void;
    handicap: string; setHandicap: (v: string) => void;
    result: string; setResult: (v: string) => void;
    gameName: string; setGameName: (v: string) => void;
    event: string; setEvent: (v: string) => void;
    date: string; setDate: (v: string) => void;
    place: string; setPlace: (v: string) => void;
    round: string; setRound: (v: string) => void;
    time: string; setTime: (v: string) => void;
    user: string; setUser: (v: string) => void;
    source: string; setSource: (v: string) => void;
    gameComment: string; setGameComment: (v: string) => void;
    copyright: string; setCopyright: (v: string) => void;
    annotation: string; setAnnotation: (v: string) => void;
}

const GameInfoModal: React.FC<GameInfoModalProps> = (props) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 font-sans text-sm" onClick={props.onClose}>
            <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-lg border border-gray-400" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-2 border-b border-gray-300 bg-gray-200 rounded-t-lg">
                    <span className="font-normal text-gray-800">対局情報</span>
                    <button onClick={props.onClose} className="text-gray-600 hover:text-gray-900 text-lg leading-none">
                        ×
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">
                    {/* Common Section */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-4">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">基本情報</span>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center mb-2">
                            <label className="w-24 text-gray-700">対局名称</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white focus:outline-none focus:border-blue-500"
                                value={props.gameName} onChange={e => props.setGameName(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-2 items-center">
                            <label className="w-24 text-gray-700">白番</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.whiteName} onChange={e => props.setWhiteName(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">黒番</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.blackName} onChange={e => props.setBlackName(e.target.value)} />

                            <label className="w-24 text-gray-700">白番ランク</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.whiteRank} onChange={e => props.setWhiteRank(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">黒番ランク</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.blackRank} onChange={e => props.setBlackRank(e.target.value)} />

                            <label className="w-24 text-gray-700">白番チーム</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.whiteTeam} onChange={e => props.setWhiteTeam(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">黒番チーム</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.blackTeam} onChange={e => props.setBlackTeam(e.target.value)} />

                            <label className="w-24 text-gray-700">コミ</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.komi} onChange={e => props.setKomi(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">置き石</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.handicap} onChange={e => props.setHandicap(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center mt-2">
                            <label className="w-24 text-gray-700">結果</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-32 bg-white" value={props.result} onChange={e => props.setResult(e.target.value)} />
                        </div>
                    </div>

                    {/* When and Where Section */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-4">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">日時・場所</span>
                        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-2 items-center mb-2">
                            <label className="w-24 text-gray-700">日付</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.date} onChange={e => props.setDate(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">場所</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.place} onChange={e => props.setPlace(e.target.value)} />

                            <label className="w-24 text-gray-700">時間</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.time} onChange={e => props.setTime(e.target.value)} />
                            <label className="w-24 text-gray-700 pl-2">回戦</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.round} onChange={e => props.setRound(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                            <label className="w-24 text-gray-700">イベント</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.event} onChange={e => props.setEvent(e.target.value)} />
                        </div>
                    </div>

                    {/* Other Section */}
                    <div className="border border-gray-300 rounded p-2 bg-gray-50 relative pt-4">
                        <span className="absolute -top-2.5 left-2 bg-gray-50 px-1 text-xs text-black">その他</span>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center mb-2">
                            <label className="w-24 text-gray-700">記録者</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.user} onChange={e => props.setUser(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center mb-2">
                            <label className="w-24 text-gray-700">情報源</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.source} onChange={e => props.setSource(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-start mb-2">
                            <label className="w-24 text-gray-700 pt-1">コメント</label>
                            <textarea className="border border-gray-400 px-1 py-0.5 w-full bg-white h-16 resize-y" value={props.gameComment} onChange={e => props.setGameComment(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center mb-2">
                            <label className="w-24 text-gray-700">著作権</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.copyright} onChange={e => props.setCopyright(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                            <label className="w-24 text-gray-700">注釈</label>
                            <input className="border border-gray-400 px-1 py-0.5 w-full bg-white" value={props.annotation} onChange={e => props.setAnnotation(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3 border-t border-gray-300 bg-gray-200 rounded-b-lg flex justify-end gap-2">
                    <button onClick={props.onClose} className="px-4 py-1.5 bg-white border border-gray-400 rounded hover:bg-gray-50 text-black text-xs shadow-sm w-20">
                        OK
                    </button>
                    <button onClick={props.onClose} className="px-4 py-1.5 bg-white border border-gray-400 rounded hover:bg-gray-50 text-black text-xs shadow-sm w-20">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameInfoModal;
