# Changelog

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
