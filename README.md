# Greek Vases Gallery

An interactive 3D gallery of Greek vases built with React, Three.js, and Vite.

## Features

- Interactive 3D environment with lighting and shadows
- Several types of procedurally generated Greek vases on pedestals
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

- `src/components/GreekVases.tsx`: Main 3D scene and interaction logic.
- `src/App.tsx`: Main application component.
- `src/App.css`: Styles for UI elements (crosshair, info text).
- `public/`: Static assets (if any).

## License

MIT
