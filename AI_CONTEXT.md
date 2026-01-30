# GORewrite Project Charter for AI Agents

## 1. Project Core Purpose
**GORewrite is a tool dedicated to creating high-quality Go materials for PRINT and PUBLISHING.**
The primary user base consists of authors and instructors creating books and handouts using Microsoft Word and other DTP software.
**Therefore, vector quality (SVG) and compatibility with Office apps are PARAMOUNT.**

## THE ULTIMATE CHALLENGE: SVG Copy/Paste to Word
- **Current Status**: This is the single biggest blocker for the project.
- **Problem**: Pasting SVG directly into Microsoft Word consistently results in color inversion (Black stones become White), rendering diagrams unusable.
- **History**: This issue has **NEVER been fully solved** despite multiple attempts. It is a known difficulty with Word's SVG rendering engine.
- **MANDATE**: **DO NOT GIVE UP.** Achieving perfect SVG copy/paste compatibility with Word is the **FINAL GOAL** of this project. Even if it requires complex hacks (off-peak colors, EMF wrapping, etc.), we must find a way.

## 2. Critical Directives for AI
- **NEVER Remove Core Features**: If a feature (like SVG export) has bugs in third-party apps (e.g., Word), allow the user to decide. Do not unilaterally remove functionality.
- **Printing is Priority**: Web features (pasting to blogs, etc.) are secondary. If a trade-off exists, optimize for Print/Word.
- **Dual-Track Strategy**:
    - **Web Extension**: For general use. SVG compatible with standard web tools. Word compatibility is "Best Effort".
    - **Desktop App (Planned)**: For DTP/Professional use. Will support native **EMF export** to solve Word issues 100%.
- **SVG Issue & Solution (Web Track)**:
    - **Issue**: Standard SVGs with styles/classes/media-queries confuse Word's parser, causing inversion.
    - **Solution**: **Flat DOM + Aggressive Offset**.
        1. **Flat DOM**: Remove ALL `<style>` tags, classes, and media queries. Use inline attributes only.
        2. **Color Offset**: Use `#121212` (Black) and `#ECECEC` (White) to evade auto-inversion.
    - **Action**: Maintain this structure for Web. Do not introduce `<style>`. For perfect Word support, push Desktop App.

## 3. Project Structure
- **Frontend**: React + Vite (Browser Extension)
- **State**: `App.tsx` manages main state.
- **Export**: `src/utils/exportUtils.ts` handles all SVG/PNG generation logic, including the color hacks.
