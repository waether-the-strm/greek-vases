# Greek Vases Gallery

An interactive 3D gallery of Greek vases built with React, Three.js, and Vite.

## Features

- Loaded 3D gallery model (hangar) providing the environment context.
- Several types of procedurally generated Greek vases on pedestals
- Window pane with texture enhancing the gallery feel.
- Background plane behind the window with a parallax effect for depth.
- Dynamic directional lighting originating from the window area, casting shadows.
- First-Person Shooter (FPS) style navigation (WASD + Mouse look)
- Ability to break vases by clicking on them
- Physics simulation for falling shards
- Pointer lock for immersive control

## Technologies Used

- React
- TypeScript
- Three.js for 3D rendering
- Vite for fast development and building

## Getting Started

### Prerequisites

- Node.js (LTS version recommended) and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

This will open the application in your default browser.

4. Build for production:

```bash
npm run build
```

## Controls

- **Click** into the scene to enable pointer lock and controls.
- **WASD Keys:** Move forward, left, backward, right.
- **Mouse:** Look around.
- **Click (while locked):** Break the vase you are looking at.
- **ESC Key:** Release pointer lock and show instructions/cursor.

## Project Structure

- `src/components/GreekVases.tsx`: Main React component integrating the 3D scene and UI.
- `src/hooks/`: Contains custom React hooks encapsulating specific logic domains (scene setup, player controls, vase management, shard physics).
- `src/hooks/useGalleryLoader.ts`: Hook responsible for loading the main gallery GLB model and related elements (window, background, light).
- `src/features/greek-vases/threeUtils.ts`: Utility functions specific to Three.js object creation for this feature.
- `src/App.tsx`: Root application component.
- `src/App.css`, `src/index.css`: Global styles and UI element styling.
- `public/`: Static assets.

## License

MIT
