# Changelog
 
## [2.0.6] - 2026-01-30
### Added
- **GIF Export & Auto-Play**: Restored GIF export feature and added playback speed control (Slow/Normal/Fast/Max).
- **Localization**: Added Japanese/English labels for playback speed.

### Fixed
- **Export Quality**: Fixed an issue where manual markers (△, □, etc.) were hidden in PNG exports. Markers are now consistently preserved as the top layer.

## [2.0.5] - 2026-01-26
### Fixed
- **Printing Overhaul**:
    - **Direct Printing**: Eliminated new tab behavior. Printing now triggers directly from the sidebar.
    - **Reliability**: Fixed the "blank page" issue by ensuring the game state is fully rendered before triggering the print dialog.
    - **UX**: Removed the intermediate preview page to provide a more seamless experience.
    - **Terminology**: Corrected terminology from "分割" (split) to "**譜分け**" (kifu splitting) across the Japanese UI.

## [2.0.4] - 2026-01-24
### Fixed
- **GIF Export**:
    - **Stability**: Refactored to use Pre-Save Flow (saves file first, then generates) to prevent browser security timeouts and "UUID filename" issues.
    - **Visual Updates**: Switched loop logic to state-driven React updates to ensure every frame is perfectly rendered (no more static images).
    - **Range**: Fixed logic to always export the full game sequence (main branch) even if the current view is at the start (Root).
    - **Filename**: Removed default filename preference. File dialog now opens with empty name (or browser default) but ensures correct extension.

## v1.5.0 (2026-01-14)
- **Word互換性の向上**: SVG/PNGエクスポート時の背景処理を改善し、Wordに貼り付けた際に背景が黒くなる問題を修正しました。
- **エクスポート画像の最適化**: 盤面の出力時に、操作用のUI要素（次の手候補の点や、選択範囲の枠など）を除外するようにしました。これにより、資料作成に適した綺麗な盤面画像が得られます。
- **保存処理の安定化**: エクスポートプログラムの基幹部分を、過去の安定版ロジックに戻しました。
