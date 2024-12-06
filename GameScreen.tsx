// BallBlasterGame.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions, Text, TouchableOpacity } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Constants
const BALL_RADIUS = 8;
const BALL_SPEED = 12;
const LAUNCH_DELAY = 150;
const BRICK_MARGIN = 3;
const BRICK_ROWS = 12;
const BRICK_COLS = 12;
const HEADER_HEIGHT = 80;
const BRICK_WIDTH = (width - (BRICK_COLS + 1) * BRICK_MARGIN) / BRICK_COLS;
const BRICK_HEIGHT = 25;
const BOTTOM_CONTROLS_HEIGHT = 80;
const LAUNCH_Y = height - BOTTOM_CONTROLS_HEIGHT - 100;
const INITIAL_LAUNCH_X = width / 2;
const MIN_ANGLE = Math.PI / 90; // 2 degrees above horizontal
const MAX_ANGLE = Math.PI - MIN_ANGLE;

// Types
interface Ball {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  launched: boolean;
}

interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  special: boolean;
  hits: number;
  color: string;
  points: number;
}

// Add brick types
type BrickType = {
  color: string;
  points: number;
  hits: number;
  probability: number;
};

const BRICK_TYPES: BrickType[] = [
  { color: '#4CAF50', points: 1, hits: 1, probability: 0.6 },    // Common green
  { color: '#2196F3', points: 2, hits: 2, probability: 0.25 },   // Blue
  { color: '#FFC107', points: 3, hits: 1, probability: 0.1 },    // Special gold
  { color: '#9C27B0', points: 5, hits: 3, probability: 0.05 },   // Rare purple
];

interface DebugBallInfo {
  x: number;
  y: number;
  launched: boolean;
}

interface DebugInfo {
  ballCount: number;
  ballPositions: DebugBallInfo[];
}

const BallBlasterGame: React.FC = () => {
  // Refs for game state
  const gameLoop = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(0);
  const isLaunching = useRef<boolean>(false);
  const launchQueue = useRef<Ball[]>([]);
  const lastLaunchTime = useRef<number>(0);
  const lastBallX = useRef<number>(INITIAL_LAUNCH_X);
  
  // Game state
  const [balls, setBalls] = useState<Ball[]>([]);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [score, setScore] = useState(0);
  const [ballCount, setBallCount] = useState(10);
  const [isGameActive, setIsGameActive] = useState(true);
  
  // Touch handling
  const touchActive = useRef<boolean>(false);
  const launchAngle = useSharedValue(0);

  // Add debug info display
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ 
    ballCount: 0, 
    ballPositions: [] 
  });

  useEffect(() => {
    // Update debug info whenever balls change
    setDebugInfo({
      ballCount: balls.length,
      ballPositions: balls.map(b => ({ 
        x: b.x, 
        y: b.y, 
        launched: b.launched 
      }))
    });
  }, [balls]);

  // Initialize game
  useEffect(() => {
    console.log('Initializing game'); // Debug log
    initializeGame();
    return () => {
      if (gameLoop.current) cancelAnimationFrame(gameLoop.current);
    };
  }, []);

  const initializeGame = useCallback(() => {
    // Initialize balls
    const initialBalls: Ball[] = Array.from({ length: ballCount }, (_, i) => ({
      id: i,
      x: INITIAL_LAUNCH_X,
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    }));

    console.log('Setting initial balls:', initialBalls.length); // Debug log
    setBalls(initialBalls);
    setBricks([]); // Clear existing bricks before setting new ones

    // Initialize bricks with random types
    const initialBricks: Brick[] = [];
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        // Random brick type selection
        const rand = Math.random();
        let cumProb = 0;
        let selectedType = BRICK_TYPES[0];
        
        for (const type of BRICK_TYPES) {
          cumProb += type.probability;
          if (rand < cumProb) {
            selectedType = type;
            break;
          }
        }

        initialBricks.push({
          id: row * BRICK_COLS + col,
          x: col * (BRICK_WIDTH + BRICK_MARGIN) + BRICK_MARGIN,
          y: row * (BRICK_HEIGHT + BRICK_MARGIN) + HEADER_HEIGHT,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          visible: true,
          special: selectedType === BRICK_TYPES[2],
          hits: selectedType.hits,
          color: selectedType.color,
          points: selectedType.points
        });
      }
    }

    console.log('Setting initial bricks:', initialBricks.length); // Debug log
    setBricks(initialBricks);
    startGameLoop();
  }, [ballCount]);

  const startGameLoop = useCallback(() => {
    const updateGame = (timestamp: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = timestamp;
      const deltaTime = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;

      // Launch queued balls
      if (isLaunching.current && launchQueue.current.length > 0) {
        const currentTime = timestamp;
        if (currentTime - lastLaunchTime.current >= LAUNCH_DELAY) {
          const ballToLaunch = launchQueue.current[0];
          console.log('Launching ball:', ballToLaunch); // Debug log

          setBalls(prev => {
            const newBalls = [...prev];
            const ballIndex = newBalls.findIndex(b => b.id === ballToLaunch.id);
            if (ballIndex !== -1) {
              newBalls[ballIndex] = {
                ...ballToLaunch,
                launched: true
              };
            }
            return newBalls;
          });

          launchQueue.current = launchQueue.current.slice(1);
          lastLaunchTime.current = currentTime;
        }
      }

      // Update ball positions and handle collisions
      setBalls(prevBalls => {
        const newBalls = [...prevBalls];
        let allBallsReturned = true;

        setBricks(prevBricks => {
          const updatedBricks = [...prevBricks];
          let bricksNeedUpdate = false;

          for (let i = 0; i < newBalls.length; i++) {
            const ball = newBalls[i];
            if (!ball.launched) continue;
            allBallsReturned = false;

            let newX = ball.x + ball.dx;
            let newY = ball.y + ball.dy;

            // Wall collisions
            if (newX - BALL_RADIUS <= 0 || newX + BALL_RADIUS >= width) {
              ball.dx = -ball.dx;
              newX = ball.x + ball.dx;
            }
            if (newY - BALL_RADIUS <= 0) {
              ball.dy = -ball.dy;
              newY = ball.y + ball.dy;
            }
            if (newY + BALL_RADIUS >= height - BOTTOM_CONTROLS_HEIGHT) {
              // Update the last ball position when it hits the bottom
              lastBallX.current = newX;
              newBalls[i] = { 
                ...ball, 
                x: lastBallX.current, 
                y: LAUNCH_Y, 
                launched: false 
              };
              continue;
            }

            // Brick collisions
            let hasCollided = false;
            for (let j = 0; j < updatedBricks.length && !hasCollided; j++) {
              const brick = updatedBricks[j];
              if (!brick.visible) continue;

              // Check collision
              if (
                newX + BALL_RADIUS > brick.x &&
                newX - BALL_RADIUS < brick.x + brick.width &&
                newY + BALL_RADIUS > brick.y &&
                newY - BALL_RADIUS < brick.y + brick.height
              ) {
                // Determine collision side
                const fromLeft = Math.abs((newX + BALL_RADIUS) - brick.x);
                const fromRight = Math.abs((newX - BALL_RADIUS) - (brick.x + brick.width));
                const fromTop = Math.abs((newY + BALL_RADIUS) - brick.y);
                const fromBottom = Math.abs((newY - BALL_RADIUS) - (brick.y + brick.height));
                const minOverlap = Math.min(fromLeft, fromRight, fromTop, fromBottom);

                // Bounce based on collision side
                if (minOverlap === fromLeft || minOverlap === fromRight) {
                  ball.dx = -ball.dx;
                  newX = ball.x + ball.dx;
                } else {
                  ball.dy = -ball.dy;
                  newY = ball.y + ball.dy;
                }

                // Update brick
                brick.hits--;
                if (brick.hits <= 0) {
                  brick.visible = false;
                  bricksNeedUpdate = true;
                  setScore(prev => prev + brick.points);
                  if (brick.special) {
                    setBallCount(prev => prev + 1);
                  }
                }
                hasCollided = true;
                updatedBricks[j] = brick;
              }
            }

            // Update ball position
            newBalls[i] = { ...ball, x: newX, y: newY };
          }

          // If all balls have returned, update their x positions to the last ball's position
          if (allBallsReturned && isLaunching.current) {
            isLaunching.current = false;
            launchQueue.current = [];
            newBalls.forEach(ball => {
              ball.x = lastBallX.current;
            });
          }

          return bricksNeedUpdate ? updatedBricks : prevBricks;
        });

        return newBalls;
      });

      gameLoop.current = requestAnimationFrame(updateGame);
    };

    gameLoop.current = requestAnimationFrame(updateGame);
  }, []);

  const recallBalls = useCallback(() => {
    setBalls(prev => prev.map(ball => ({
      ...ball,
      x: lastBallX.current, // Use last ball position
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    })));
    isLaunching.current = false;
    launchQueue.current = [];
  }, []);

  const onGestureEvent = useCallback((event: any) => {
    if (!isGameActive) return;
    
    const touchX = event.nativeEvent.x;
    const touchY = event.nativeEvent.y;
    
    // Calculate angle directly from launch point to touch position
    const dx = touchX - INITIAL_LAUNCH_X;
    const dy = touchY - LAUNCH_Y;
    let angle = Math.atan2(-dy, dx);

    // Convert angle to be between 0 and 2π
    angle = angle < 0 ? angle + 2 * Math.PI : angle;
    
    // Clamp the angle between MIN_ANGLE and MAX_ANGLE
    if (angle > MAX_ANGLE) {
      angle = MAX_ANGLE;
    } else if (angle < MIN_ANGLE) {
      angle = MIN_ANGLE;
    }
    
    launchAngle.value = angle;
    touchActive.current = true;
  }, [isGameActive]);

  const onGestureEnd = useCallback(() => {
    if (!isGameActive || !touchActive.current) return;
    
    touchActive.current = false;
    console.log('Gesture end, preparing launch'); // Debug log

    // Launch balls in the direction of the last touch point
    const angle = launchAngle.value;
    const dx = Math.cos(angle) * BALL_SPEED;
    const dy = -Math.sin(angle) * BALL_SPEED;

    // Create launch queue with proper velocities
    const unlaunched = balls.filter(ball => !ball.launched);
    console.log('Unlaunched balls:', unlaunched.length); // Debug log

    if (unlaunched.length > 0) {
      launchQueue.current = unlaunched.map(ball => ({
        ...ball,
        dx,
        dy
      }));
      
      isLaunching.current = true;
      lastLaunchTime.current = performance.now() - LAUNCH_DELAY; // Start first launch immediately
      console.log('Launch queue created:', launchQueue.current.length); // Debug log
    }
  }, [balls, isGameActive]);

  // Animated style for the direction indicator
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 0 },
      { rotate: `${launchAngle.value}rad` },
      { scaleX: 1.2 }, // Make the line slightly longer
    ],
  }));

  // Add debug button to force launch
  const debugForceLaunch = useCallback(() => {
    const angle = Math.PI / 4; // 45 degrees
    const dx = Math.cos(angle) * BALL_SPEED;
    const dy = -Math.sin(angle) * BALL_SPEED;

    setBalls(prev => prev.map(ball => ({
      ...ball,
      dx,
      dy,
      launched: true
    })));
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.ballSection}>
          <Text style={styles.ballLabel}>BALLS</Text>
          <Text style={styles.ballValue}>{ballCount}</Text>
        </View>
      </View>

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onEnded={onGestureEnd}
        onFailed={onGestureEnd}
        onCancelled={onGestureEnd}
      >
        <View style={styles.gameArea}>
          {/* Debug marker for launch position */}
          <View 
            style={[
              styles.debugMarker,
              {
                left: INITIAL_LAUNCH_X - 2,
                top: LAUNCH_Y - 2,
              }
            ]} 
          />

          {/* Balls with enhanced visibility */}
          {balls.map((ball) => (
            <View
              key={ball.id}
              style={[
                styles.ball,
                {
                  left: ball.x - BALL_RADIUS,
                  top: ball.y - BALL_RADIUS,
                  width: BALL_RADIUS * 2,
                  height: BALL_RADIUS * 2,
                  backgroundColor: ball.launched ? '#ff0000' : '#ffffff',
                  borderWidth: 2,
                  borderColor: '#000',
                },
              ]}
            />
          ))}

          {/* Bricks */}
          {bricks.map((brick) =>
            brick.visible && (
              <View
                key={brick.id}
                style={[
                  styles.brick,
                  {
                    left: brick.x,
                    top: brick.y,
                    width: brick.width,
                    height: brick.height,
                    backgroundColor: brick.color,
                    opacity: brick.hits < BRICK_TYPES[3].hits ? 0.8 : 1,
                  },
                ]}
              />
            )
          )}

          {/* Direction Indicator */}
          {touchActive.current && (
            <Animated.View
              style={[
                styles.directionIndicator,
                {
                  left: INITIAL_LAUNCH_X,
                  top: LAUNCH_Y,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
                indicatorStyle,
              ]}
            />
          )}

          {/* Debug Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Balls: {debugInfo.ballCount}{'\n'}
              First Ball: {debugInfo.ballPositions[0] ? 
                `x:${Math.round(debugInfo.ballPositions[0].x)} y:${Math.round(debugInfo.ballPositions[0].y)} ${debugInfo.ballPositions[0].launched ? 'launched' : 'waiting'}` 
                : 'none'}{'\n'}
              Launch Queue: {launchQueue.current.length}{'\n'}
              Is Launching: {isLaunching.current ? 'yes' : 'no'}
            </Text>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={debugForceLaunch}
            >
              <Text style={styles.debugButtonText}>Force Launch</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PanGestureHandler>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={recallBalls}
        >
          <Text style={styles.controlButtonText}>RECALL</Text>
        </TouchableOpacity>
        <View style={styles.buttonPlaceholder} />
        <View style={styles.buttonPlaceholder} />
        <View style={styles.buttonPlaceholder} />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Darker background
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  scoreSection: {
    alignItems: 'center',
  },
  ballSection: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  ballLabel: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ballValue: {
    color: '#4CAF50',
    fontSize: 28,
    fontWeight: 'bold',
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  ball: {
    position: 'absolute',
    borderRadius: BALL_RADIUS,
    zIndex: 100, // Increase z-index
  },
  brick: {
    position: 'absolute',
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  directionIndicator: {
    position: 'absolute',
    height: 3,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Brighter indicator
    transformOrigin: 'left',
    zIndex: 1000,
  },
  bottomControls: {
    height: BOTTOM_CONTROLS_HEIGHT,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 2,
    borderTopColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 20,
    zIndex: 20,
  },
  controlButton: {
    backgroundColor: '#444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#666',
    minWidth: 80,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonPlaceholder: {
    width: 80,
    height: 42,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#222',
    opacity: 0.5,
  },
  debugMarker: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#00ff00',
    zIndex: 99,
  },
  debugInfo: {
    position: 'absolute',
    top: 100,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
  debugButton: {
    backgroundColor: '#ff0000',
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default BallBlasterGame;

