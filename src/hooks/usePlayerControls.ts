import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// Define jump strength and gravity constants
const JUMP_STRENGTH = 0.18;
const GRAVITY = 0.007;
// Touch sensitivity and threshold
const TOUCH_ROTATE_SENSITIVITY = 0.005;
const TOUCH_MOVE_THRESHOLD = 20; // Pixels threshold to initiate move

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  isOnGround: boolean; // Renamed from canJump for clarity
}

interface UsePlayerControlsProps {
  isPointerLocked: boolean;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  initialPosition?: THREE.Vector3;
  cameraHeight: number;
}

export const usePlayerControls = ({
  isPointerLocked,
  cameraRef,
  initialPosition = new THREE.Vector3(0, 2.5, -12), // Default initial position
  cameraHeight,
}: UsePlayerControlsProps) => {
  const playerStateRef = useRef<PlayerState>({
    position: initialPosition.clone(),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, Math.PI, 0, "YXZ"),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    isOnGround: false, // Start assuming not on ground initially
  });

  // Refs for touch state
  const touchActiveRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Event Handlers memoized with useCallback
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Allow keyboard controls only if pointer is not locked (or for specific keys like ESC maybe)
      // Or adjust logic based on whether touch is active
      if (!isPointerLocked && event.key !== "Escape") return; // Basic check, might need refinement

      const player = playerStateRef.current;
      switch (event.code) {
        case "KeyW":
          player.moveForward = true;
          break;
        case "KeyS":
          player.moveBackward = true;
          break;
        case "KeyA":
          player.moveLeft = true;
          break;
        case "KeyD":
          player.moveRight = true;
          break;
        case "Space": // Handle jump
          if (player.isOnGround) {
            player.velocity.y = JUMP_STRENGTH;
            player.isOnGround = false;
          }
          break;
      }
    },
    [isPointerLocked]
  ); // Depend on isPointerLocked

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // Always allow key up events to stop movement
    switch (event.code) {
      case "KeyW":
        playerStateRef.current.moveForward = false;
        break;
      case "KeyS":
        playerStateRef.current.moveBackward = false;
        break;
      case "KeyA":
        playerStateRef.current.moveLeft = false;
        break;
      case "KeyD":
        playerStateRef.current.moveRight = false;
        break;
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      // Only allow mouse move if pointer is locked (desktop experience)
      if (!isPointerLocked || !cameraRef.current || touchActiveRef.current)
        return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      playerStateRef.current.rotation.y -= movementX * 0.002;
      playerStateRef.current.rotation.x -= movementY * 0.002;

      // Clamp vertical rotation
      playerStateRef.current.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, playerStateRef.current.rotation.x)
      );

      // Apply rotation to the camera
      cameraRef.current.rotation.copy(playerStateRef.current.rotation);
    },
    [isPointerLocked, cameraRef] // touchActiveRef is implicitly handled by the check
  );

  // --- Touch Event Handlers ---
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      // Don't handle touch if pointer is locked (desktop mode)
      if (isPointerLocked) return;
      // Use only the first touch
      if (event.touches.length === 1) {
        event.preventDefault(); // Prevent scrolling/zooming
        touchActiveRef.current = true;
        touchStartRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        // Reset movement flags on new touch start
        playerStateRef.current.moveForward = false;
        playerStateRef.current.moveBackward = false;
      }
    },
    [isPointerLocked]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      // Don't handle touch if pointer is locked or no active touch
      if (
        isPointerLocked ||
        !touchActiveRef.current ||
        !touchStartRef.current ||
        !cameraRef.current
      )
        return;

      if (event.touches.length === 1) {
        event.preventDefault(); // Prevent scrolling/zooming
        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        // --- Rotation (Horizontal Drag) ---
        playerStateRef.current.rotation.y -= deltaX * TOUCH_ROTATE_SENSITIVITY;
        // Note: We are not handling vertical rotation via touch for simplicity,
        // but could be added using deltaY similar to mouse look if desired.
        // playerStateRef.current.rotation.x -= deltaY * TOUCH_ROTATE_SENSITIVITY * 0.5; // Example
        // Clamp vertical rotation if added
        // playerStateRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerStateRef.current.rotation.x));

        cameraRef.current.rotation.copy(playerStateRef.current.rotation);

        // --- Movement (Vertical Drag) ---
        if (deltaY < -TOUCH_MOVE_THRESHOLD) {
          // Swipe Up -> Move Forward
          playerStateRef.current.moveForward = true;
          playerStateRef.current.moveBackward = false;
        } else if (deltaY > TOUCH_MOVE_THRESHOLD) {
          // Swipe Down -> Move Backward
          playerStateRef.current.moveForward = false;
          playerStateRef.current.moveBackward = true;
        } else {
          // Within threshold -> No vertical movement
          playerStateRef.current.moveForward = false;
          playerStateRef.current.moveBackward = false;
        }

        // Update start position for continuous movement/rotation calculation relative to the last point
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    },
    [isPointerLocked, cameraRef]
  ); // Depend on isPointerLocked and cameraRef

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    // Only handle if a touch was active
    if (touchActiveRef.current) {
      // Prevent default only if we actually handled the touch sequence
      event.preventDefault();
      touchActiveRef.current = false;
      touchStartRef.current = null;
      // Stop movement when touch ends
      playerStateRef.current.moveForward = false;
      playerStateRef.current.moveBackward = false;
    }
  }, []); // No dependencies needed

  // Function to update player position based on state
  const updatePlayerPosition = useCallback(() => {
    if (!cameraRef.current) return;

    const player = playerStateRef.current;
    const camera = cameraRef.current;
    const velocity = player.velocity; // Use velocity from state
    const direction = new THREE.Vector3();

    // Horizontal movement direction (Includes touch forward/backward)
    direction.z = Number(player.moveBackward) - Number(player.moveForward);
    direction.x = Number(player.moveRight) - Number(player.moveLeft); // Keep keyboard side movement
    direction.normalize();

    const moveSpeed = 0.1;
    const horizontalVelocity = new THREE.Vector3(
      direction.x * moveSpeed,
      0,
      direction.z * moveSpeed
    );

    // Apply rotation to horizontal movement direction
    // Rotation is updated by both mouse and touch handlers now
    const euler = new THREE.Euler(0, player.rotation.y, 0, "YXZ");
    const moveDirection = horizontalVelocity.applyEuler(euler);

    // --- Vertical Movement (Gravity and Jumping) ---
    velocity.y -= GRAVITY; // Apply gravity
    camera.position.y += velocity.y; // Apply vertical velocity

    // Ground check
    if (camera.position.y <= cameraHeight) {
      camera.position.y = cameraHeight;
      velocity.y = 0; // Stop vertical movement
      player.isOnGround = true; // Player is on the ground
    } else {
      player.isOnGround = false; // Player is in the air
    }

    // --- Horizontal Movement (with Boundaries) ---
    const nextPositionX = camera.position.x + moveDirection.x;
    const nextPositionZ = camera.position.z + moveDirection.z;

    const bounds = { xMin: -9.5, xMax: 9.5, zMin: -14.5, zMax: 14.5 };

    // Apply horizontal movement only if within bounds
    if (nextPositionX >= bounds.xMin && nextPositionX <= bounds.xMax) {
      camera.position.x = nextPositionX;
    }
    if (nextPositionZ >= bounds.zMin && nextPositionZ <= bounds.zMax) {
      camera.position.z = nextPositionZ;
    }

    // Update player state position
    player.position.copy(camera.position);
  }, [cameraRef, cameraHeight]);

  // Effect to attach and detach event listeners
  useEffect(() => {
    // Keyboard and Mouse listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    // Touch listeners - use { passive: false } for preventDefault()
    // Attach to window for simplicity, could be attached to the canvas element
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: false }); // Handle cancellation too

    return () => {
      // Keyboard and Mouse cleanup
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      // Touch cleanup
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
    // Add touch handlers to dependency array
  }, [
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // Return necessary values/functions for the component to use
  return {
    playerStateRef, // Expose the ref if direct access needed elsewhere
    updatePlayerPosition, // Expose the update function for the animation loop
  };
};
