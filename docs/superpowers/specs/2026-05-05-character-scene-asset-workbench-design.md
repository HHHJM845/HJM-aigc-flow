# Character And Scene Asset Workbench Design

## Goal

Add a dedicated character and scene asset generation workspace between 剧本拆解 and 无限画布. The workspace helps users turn script intent into reusable visual assets before they start arranging nodes on the canvas.

The first version focuses on the core production loop:

1. Create a character or scene card.
2. Choose a visual style.
3. Generate an image asset.
4. Save the result into the existing asset library.
5. Reuse the asset from 资产管理, the canvas asset panel, or image/video node reference workflows.

## Navigation

Add a new bottom tab between 剧本拆解 and 无限画布.

Proposed tab:

- Key: `assetWorkbench`
- Label: `角色场景`
- Icon: `recent_actors` or `theater_comedy`

Final order:

`选题 -> 剧本拆解 -> 角色场景 -> 无限画布 -> 分镜管理 -> 视频管理 -> 资产管理 -> 模板库`

## Visual Direction

Use the Stitch export as the main layout and visual direction, adapted to the existing React app shell. The implementation should preserve the same premium dark atelier feel: deep black background, low-contrast graphite panels, soft glass surfaces, pill controls, compact metadata labels, and restrained silver/gray highlights.

This page may be slightly more polished and cinematic than the rest of the operational views, but it still needs to feel native to JM AIGC STUDIO. Do not copy the exported HTML directly; translate the visual language into reusable React/Tailwind components using local assets and existing project data.

Layout:

- Left column: card management and recent generated items.
- Center column: active card editor, style strip, generation controls, and large preview.
- Right column: generation parameters, prompt preview, progress, and asset status.

The UI should reuse Manrope/Inter typography and Material Symbols. It should keep the Stitch-like effects where useful:

- translucent glass side panels
- dark graphite input fields
- rounded pill segmented controls
- horizontal square style thumbnails
- selected style glow/ring
- large generated preview with floating overlay controls
- small status chips such as `已入库`, `生成中`, `草稿`
- right-side parameter panel with compact labels and prompt preview

Cards should remain functional and scan-friendly. Avoid adding a marketing-style hero section or decorative background shapes.

## Core Concepts

### Asset Workbench Card

The new workspace stores project-level cards separate from `AssetItem`.

Each card represents a planned or generated visual asset. Saving a card result creates or updates an `AssetItem` in the existing project asset library.

Card fields:

- `id`
- `kind`: `character` or `scene`
- `name`
- `roleTag` for characters, such as `主角`, `配角`, `反派`, `群众`
- `description`
- `referenceImage`
- `styleId`
- `ratio`: `1:1`, `16:9`, `9:16`, `4:3`
- `quality`: default to current image generation default if quality is not exposed globally
- `generatedImage`
- `assetId`
- `status`: `draft`, `generating`, `generated`, `saved`, `error`
- `createdAt`
- `updatedAt`

Scene cards can reuse the `description` field for location, time, mood, weather, and color details in the first version. More detailed scene-only fields can be added later if the workflow proves useful.

### Visual Styles

Provide a horizontal style strip similar to the reference screenshot.

Initial style options:

- 复古漫画
- 美式 3D
- 三渲二
- 女频漫画
- 吉卜力
- 3D 国创
- JoJo
- 赛博朋克
- 水墨国风
- 厚涂电影感

Each style has:

- `id`
- `name`
- `thumbnail`
- `promptPreset`

For the first version, styles can be local constants. Later they can be connected to 模板库 if we want shared editable style presets.

## Functional Requirements

### Left Column

The left column manages cards.

Functions:

- Toggle between `角色卡` and `场景卡`.
- Add a new card for the active type.
- Show recently created or generated cards.
- Select a card to edit it.
- Show status badges: 草稿, 生成中, 已生成, 已入库, 失败.
- Rename, duplicate, and delete cards.

Empty state:

- If there are no cards, show a concise prompt to add a role or scene card.

### Center Column

The center column is the main creation surface.

Functions:

- Edit card name.
- Edit card description.
- Upload a reference image.
- Choose a visual style from a horizontal strip.
- Generate image.
- Regenerate image.
- Show large generated preview.
- Save generated preview into the asset library.
- Add generated preview to canvas as an image node.

Generation behavior:

- Use the existing `/api/generate` image generation route.
- Compose the prompt from card kind, name, description, selected style prompt preset, and optional reference image.
- Do not auto-save to asset library immediately after generation. The user explicitly clicks 保存到资产库.

### Right Column

The right column exposes generation settings and status.

Functions:

- Display generation type: 角色卡 or 场景卡.
- Display selected style.
- Select output ratio.
- Display quality if supported by the current image generation route.
- Show prompt preview.
- Show generation progress/status.
- Show whether the generated result is already saved to the asset library.

Prompt preview should be readable and update as the user edits the card, but the user does not need to edit raw prompt text in the first version.

## Asset Library Integration

When the user saves a generated result:

- Create an `AssetItem`.
- Use `type: "image"`.
- Use `category: "character"` for character cards.
- Use `category: "scene"` for scene cards.
- Store the generated image URL in `src`.
- Use the card name as the asset name.
- Store the new asset id on the card as `assetId`.

Saved assets must appear in:

- 资产管理.
- Canvas asset panel.
- Image node asset picker.

Dragging or selecting those assets should keep using the existing canvas asset workflows.

## Project Persistence

Add a new project field:

`assetWorkbenchCards: AssetWorkbenchCard[]`

Loading older projects should default this field to an empty array.

The workspace must autosave card edits through the same current project patch pattern used by canvas, storyboard, video, topic history, and asset saves. This avoids overwriting project fields during concurrent autosaves.

## Error Handling

Generation errors:

- Set the active card status to `error`.
- Keep the user-entered card details and selected style.
- Show a concise error message near the generation controls.

Asset save errors:

- Do not change the card to `saved`.
- Keep the generated preview visible.
- Show a retry option.

Reference image errors:

- Reject unsupported file types.
- Keep the previous reference image if upload fails.

## Testing

Focused tests:

- Bottom tab order includes 角色场景 between 剧本拆解 and 无限画布.
- Loading legacy projects defaults `assetWorkbenchCards` to `[]`.
- Saving an asset workbench card patch preserves existing project fields such as `storyboardOrder`, `videoOrder`, `assets`, and `topicHistory`.
- Saving a generated character card creates an `AssetItem` with `category: "character"`.
- Saving a generated scene card creates an `AssetItem` with `category: "scene"`.

Manual verification:

- Create a character card, choose a style, generate, save to asset library, confirm it appears in 资产管理.
- Create a scene card, generate, save, confirm it appears in the canvas asset panel.
- Reopen the project and confirm cards, selected styles, generated images, and saved status persist.

## First Version Scope

Included:

- Dedicated 角色场景 tab.
- Three-column workbench UI based on the Stitch reference.
- Character and scene cards.
- Local style presets.
- Reference image upload for generation.
- Image generation.
- Explicit save to existing asset library.
- Reuse from asset library and canvas asset flows.
- Project persistence.

Not included in first version:

- Complex character relationship management.
- Detailed worldbuilding database.
- Multi-version gallery per card.
- Team comments or approvals on cards.
- Editable shared style library in 模板库.
- Video generation directly from this workspace.

## Open Design Notes

The recommended first version keeps this workspace as a focused bridge between script breakdown and canvas creation. It should make visual preparation easier without replacing the existing asset library or canvas node generation features.
