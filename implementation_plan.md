# 詰碁分岐機能 実装計画

## 概要
GORewrite（拡張機能/フロントエンド）において、詰碁の「正解」「失敗」「変化図」などの分岐（Branching）を作成・再生できる機能を実装する。
Backend（Sanity）が見当たらないため、まずはExtension単体でのSGF/内部データ構造を用いた実装を行う。

## User Review Required
- **UXの変更**: 分岐がある場合、ツールバー付近に「分岐選択ボタン（A, B, C...）」が表示されるようになります。

## Proposed Changes

### [GORewrite] Frontend Logic & UI

#### [MODIFY] [App.tsx](file:///C:/Users/lucky/VibeWorks-Yogapro-Win/GORewrite/src/App.tsx)
1. **`stepForward` の修正**:
   - 常に `children[0]` を選ぶのではなく、`selectedChildIndex` で選択された分岐に進むように変更。
2. **`commitState` の確認と修正**:
   - `addMove` を呼び出す際、既存の分岐があればそれを再利用し、なければ新規作成する（`treeUtilsV2`参照）。
3. **分岐選択UIの実装**:
   - 現在のノードに複数の子（`children.length > 1`）がある場合、分岐選択ボタンを表示する。
   - ボタンをクリックすると `selectedChildIndex` を更新するか、直ちにその分岐へ移動する。
   - 石の上に「A, B」などをオーバーレイ表示するのが理想だが、まずはツールバーでの実装を優先。

#### [MODIFY] [treeUtilsV2.ts](file:///C:/Users/lucky/VibeWorks-Yogapro-Win/GORewrite/src/utils/treeUtilsV2.ts)
- （必要であれば）`stepRunning` などのイテレータヘルパーを追加。現在は変更不要見込み。

## Verification Plan

### Automated Tests
- `npm run build` でビルドが通ることを確認。

### Manual Verification
1. **新規分岐の作成**:
   - 碁盤に石を置き（Move 1）、次に進む。
   - Move 1に戻り、別の場所に石を置く（Move 2-B）。
   - Move 1に戻り、さらに別の場所に石を置く（Move 2-C）。
2. **分岐のナビゲーション**:
   - Move 1の状態で「Next」ボタン（または矢印キー）を押す。
   - `selectedChildIndex` に従った分岐に進むか確認。
   - 分岐選択UI（A, B, Cボタン）で進路を切り替えられるか確認。
3. **SGFエクスポート/インポート**:
   - 分岐を含むSGFを保存し、再読み込みして構造が維持されているか確認。
