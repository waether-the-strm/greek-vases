import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";

// Define jump strength and gravity constants
const JUMP_STRENGTH = 0.18;
const GRAVITY = 0.007;
// Touch sensitivity and threshold
const TOUCH_ROTATE_SENSITIVITY = 0.005;
//const TOUCH_MOVE_THRESHOLD = 20; // Pixels threshold to initiate move (used for tap vs drag, not joystick speed)
const MOVE_SPEED = 0.15; // Reduced speed from 0.3
const JOYSTICK_ROTATE_SENSITIVITY = 0.001; // Sensitivity for rotation while using joystick

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
  setIsTouchControlActive: (isActive: boolean) => void;
  handleVaseClick: (coordsNDC: THREE.Vector2) => void; // Add vase click handler prop
}

// Define the return type of the hook
interface UsePlayerControlsReturn {
  playerStateRef: React.MutableRefObject<PlayerState>;
  updatePlayerPosition: () => void;
  joystickCenter: { x: number; y: number } | null;
  joystickRadius: number;
}

export const usePlayerControls = ({
  isPointerLocked,
  cameraRef,
  initialPosition = new THREE.Vector3(0, 2.5, -12), // Default initial position
  cameraHeight,
  setIsTouchControlActive, // Destructure the setter function
  handleVaseClick, // Destructure the handler
}: UsePlayerControlsProps): UsePlayerControlsReturn => {
  const playerStateRef = useRef<PlayerState>({
    position: initialPosition.clone(),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    isOnGround: false, // Start assuming not on ground initially
  });

  // Remove the local ref for touch active state
  // const isTouchControlActiveRef = useRef(false);

  // Refs for general touch state
  const touchActiveRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null); // Stores LAST touch position for delta calculation
  const touchInitialPosRef = useRef<{ x: number; y: number } | null>(null); // Stores INITIAL touch position
  const touchStartTimeRef = useRef<number>(0);
  const touchMovedRef = useRef<boolean>(false);

  // Refs for virtual joystick state
  const isJoystickTouchRef = useRef<boolean>(false);
  // Use state for joystick geometry so component can react
  const [joystickCenter, setJoystickCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [joystickRadius, setJoystickRadius] = useState<number>(0);
  const joystickMoveVectorRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0)); // Stores calculated move vector (x, y relative to joystick center)

  // Effect to calculate joystick geometry based on screen size
  useEffect(() => {
    const updateJoystickGeometry = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const newCenter = {
        x: screenWidth / 2,
        y: screenHeight * 0.875, // Move lower (7/8ths down)
      };
      const newRadius = screenHeight / 20; // Make smaller (was / 8)
      setJoystickCenter(newCenter);
      setJoystickRadius(newRadius);
      // Remove log
      // console.log("Joystick Geometry Updated:", newCenter, newRadius);
    };

    updateJoystickGeometry();
    window.addEventListener("resize", updateJoystickGeometry);

    return () => {
      window.removeEventListener("resize", updateJoystickGeometry);
    };
  }, []);

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
      // console.log("Touch start event received", { // Remove log
      //   isPointerLocked,
      //   touchActive: touchActiveRef.current,
      //   // isTouchControlActive: isTouchControlActiveRef.current, // Removed ref check
      //   touches: event.touches.length
      // });

      // Don't handle touch if pointer is locked (desktop mode)
      if (isPointerLocked) {
        // console.log("Pointer is locked, ignoring touch"); // Remove log
        return;
      }

      // Use only the first touch
      if (event.touches.length === 1) {
        // console.log("Single touch detected, activating touch controls"); // Remove log
        event.preventDefault(); // Prevent scrolling/zooming
        const touch = event.touches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;

        touchActiveRef.current = true;
        touchInitialPosRef.current = { x: touchX, y: touchY }; // Store initial position
        touchStartRef.current = { x: touchX, y: touchY }; // Store initial also as "last" position
        touchStartTimeRef.current = Date.now();
        touchMovedRef.current = false;
        joystickMoveVectorRef.current.set(0, 0); // Reset move vector

        // Check if touch started inside the joystick area (use state values)
        if (joystickCenter && joystickRadius > 0) {
          const dx = touchX - joystickCenter.x;
          const dy = touchY - joystickCenter.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < joystickRadius * joystickRadius) {
            isJoystickTouchRef.current = true;
            // console.log("Joystick touch started"); // Remove log
          } else {
            isJoystickTouchRef.current = false;
            // console.log("Non-joystick touch started"); // Remove log
          }
        } else {
          isJoystickTouchRef.current = false; // Default if geometry not calculated yet
          // console.log("Joystick geometry not ready, non-joystick touch assumed"); // Remove log
        }

        setIsTouchControlActive(true);
      } else {
        // console.log("Multiple touches detected, ignoring"); // Remove log
      }
    },
    // Add state values as dependencies for the check logic, though geometry itself updates via useEffect
    [isPointerLocked, setIsTouchControlActive, joystickCenter, joystickRadius]
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

        // Check if movement exceeds a small threshold to consider it a "move" not a "tap"
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          touchMovedRef.current = true;
        }

        // --- Logic based on where touch started ---
        if (isJoystickTouchRef.current) {
          // --- VIRTUAL JOYSTICK MOVEMENT ---
          const touch = event.touches[0];
          const joyX = touch.clientX - joystickCenter!.x;
          const joyY = touch.clientY - joystickCenter!.y; // Y is inverted on screen vs 3D
          const distance = Math.sqrt(joyX * joyX + joyY * joyY);
          const radius = joystickRadius; // Use state value

          if (distance > 0) {
            // Avoid division by zero
            // Normalize the joystick vector
            const normalizedX = joyX / distance;
            const normalizedZ = joyY / distance; // Use joyY for Z movement

            // Calculate speed based on distance (clamped to radius)
            const clampedDistance = Math.min(distance, radius);
            const speedFactor = clampedDistance / radius; // 0 to 1
            // Use MOVE_SPEED defined at the top scope
            const currentMoveSpeed = MOVE_SPEED * speedFactor;

            // Store the calculated X and Z speed components directly
            const moveComponentX = normalizedX * currentMoveSpeed;
            const moveComponentZ = normalizedZ * currentMoveSpeed;
            joystickMoveVectorRef.current.set(moveComponentX, moveComponentZ);
            // Log joystick vector
            // console.log("Joystick Vector (X, Z speed):", joystickMoveVectorRef.current); // Remove log

            // --- Apply simultaneous rotation based on joystick X deflection ---
            // Use joyX (raw deflection from center) for rotation amount
            playerStateRef.current.rotation.y -=
              joyX * JOYSTICK_ROTATE_SENSITIVITY;
            // Apply rotation immediately to the camera
            if (cameraRef.current) {
              cameraRef.current.rotation.copy(playerStateRef.current.rotation);
              // console.log("Rotation Applied:", rotationDeltaX); // Remove log
            }
          } else {
            joystickMoveVectorRef.current.set(0, 0); // No movement if at center
          }

          // Clear keyboard movement flags if joystick is active
          playerStateRef.current.moveForward = false;
          playerStateRef.current.moveBackward = false;
          playerStateRef.current.moveLeft = false;
          playerStateRef.current.moveRight = false;
        } else {
          // --- ROTATION (Non-Joystick Touch) ---
          // Check for horizontal swipe (significant X delta, small Y delta from INITIAL position)
          const initialDeltaX =
            event.touches[0].clientX - touchInitialPosRef.current!.x;
          const initialDeltaY =
            event.touches[0].clientY - touchInitialPosRef.current!.y;

          // Reset joystick vector if touch is outside joystick area
          joystickMoveVectorRef.current.set(0, 0);

          if (
            Math.abs(initialDeltaX) > Math.abs(initialDeltaY) * 1.5 &&
            Math.abs(initialDeltaX) > 10
          ) {
            // Heuristic: More horizontal than vertical, and moved enough
            // Apply rotation based on delta since LAST frame
            const rotationDeltaX =
              event.touches[0].clientX - touchStartRef.current!.x;
            playerStateRef.current.rotation.y -=
              rotationDeltaX * TOUCH_ROTATE_SENSITIVITY;
            cameraRef.current.rotation.copy(playerStateRef.current.rotation);
            // console.log("Rotation Applied:", rotationDeltaX); // Remove log
          } else {
            // console.log("Non-joystick touch, not enough horizontal swipe for rotation."); // Remove log
          }
        }

        // Update LAST touch position for next frame's delta calculation (used for rotation)
        touchStartRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
    },
    [isPointerLocked, cameraRef, joystickCenter, joystickRadius]
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      // console.log("Touch end event received", { // Keep removed
      //   touchActive: touchActiveRef.current,
      // });

      if (touchActiveRef.current) {
        // Only prevent default if we are sure it wasn't a tap potentially
        // event.preventDefault();

        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTimeRef.current;
        const touch = event.changedTouches[0]; // Get the touch info at end

        // console.log("Tap Check:", { // Keep removed
        //   duration: touchDuration,
        //   moved: touchMovedRef.current,
        // });

        // Check for tap: short duration and no significant movement
        if (touchDuration < 200 && !touchMovedRef.current) {
          // Calculate NDC from tap coordinates
          const x = (touch.clientX / window.innerWidth) * 2 - 1;
          const y = -(touch.clientY / window.innerHeight) * 2 + 1;
          const coordsNDC = new THREE.Vector2(x, y);

          handleVaseClick(coordsNDC); // Call with calculated NDC
        } else {
          // If it wasn't a tap, ensure movement flags/vector stops on touch end
          playerStateRef.current.moveForward = false;
          playerStateRef.current.moveBackward = false;
          playerStateRef.current.moveLeft = false; // Also reset side movement just in case
          playerStateRef.current.moveRight = false;
          joystickMoveVectorRef.current.set(0, 0); // Reset joystick vector
        }

        touchActiveRef.current = false;
        touchStartRef.current = null;
        touchInitialPosRef.current = null; // Clear initial pos ref
        touchMovedRef.current = false;
        isJoystickTouchRef.current = false; // Reset joystick touch flag
      }
    },
    [handleVaseClick]
  );

  // Function to update player position based on state
  const updatePlayerPosition = useCallback(() => {
    if (!cameraRef.current) return;

    const player = playerStateRef.current;
    const camera = cameraRef.current;
    const velocity = player.velocity; // Use velocity from state
    const direction = new THREE.Vector3();

    // Log state at start
    // console.log("UpdatePos Start:", { moveFwd: player.moveForward, moveBwd: player.moveBackward }); // Keep logs removed

    // --- Calculate Horizontal Movement ---
    let horizontalVelocity = new THREE.Vector3(0, 0, 0);
    const joystickVec = joystickMoveVectorRef.current;

    if (joystickVec.lengthSq() > 0) {
      // --- Joystick Movement ---
      // Use joystick vector directly (joystickVec.x is side speed, joystickVec.y is forward/backward speed)
      const sideSpeed = joystickVec.x * 0.75; // Apply optional scaling factor for strafing
      const forwardSpeed = joystickVec.y; // joystick Y positive is down screen -> backward -> positive Z world
      direction.set(sideSpeed, 0, forwardSpeed);

      // Log calculated direction from joystick
      // console.log("UpdatePos Joystick Direction:", direction); // Remove log
      horizontalVelocity.copy(direction); // Use direction directly as velocity for joystick
    } else {
      // --- Keyboard Movement (Fallback) ---
      direction.z = Number(player.moveBackward) - Number(player.moveForward);
      direction.x = Number(player.moveRight) - Number(player.moveLeft);
      direction.normalize();

      // Log calculated direction from keyboard
      // console.log("UpdatePos Keyboard Direction:", direction);

      horizontalVelocity.set(
        direction.x * MOVE_SPEED, // Use MOVE_SPEED defined above
        0,
        direction.z * MOVE_SPEED // Use MOVE_SPEED defined above
      );
    }

    // Log horizontal velocity before rotation
    // console.log("UpdatePos H. Velocity:", horizontalVelocity);

    // Apply camera rotation to the calculated horizontal velocity
    const euler = new THREE.Euler(0, player.rotation.y, 0, "YXZ");
    const moveDirection = horizontalVelocity.clone().applyEuler(euler);

    // Log final move direction
    // console.log("UpdatePos Move Direction:", moveDirection);

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
    joystickCenter, // Return state
    joystickRadius, // Return state
  };
};
