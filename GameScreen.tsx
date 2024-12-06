// BallBlasterGame.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, Modal } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Constants
const BALL_RADIUS = 6;
const BALL_SPEED = 12;
const LAUNCH_DELAY = 150;
const BRICK_MARGIN = 3;
const INITIAL_BRICK_ROWS = 4; // Start with fewer rows
const BRICK_COLS = 8; // Fewer columns too
const HEADER_HEIGHT = 80;
const BOTTOM_CONTROLS_HEIGHT = 80;
const BRICK_WIDTH = (width - (BRICK_COLS + 1) * BRICK_MARGIN) / BRICK_COLS;
const BRICK_HEIGHT = 25;
const LAUNCH_Y = height - BOTTOM_CONTROLS_HEIGHT - 100;
const INITIAL_LAUNCH_X = width / 2;
const BRICK_DROP_AMOUNT = 40; // How far bricks drop after each turn
const LOSS_LINE = LAUNCH_Y - BRICK_HEIGHT * 2; // Line where bricks cause loss

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

interface GameState {
  level: number;
  gameStatus: 'playing' | 'won' | 'lost';
}

const BallBlasterGame: React.FC = () => {
  // Remove debug state
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
  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    gameStatus: 'playing'
  });
  
  // Touch handling
  const touchActive = useRef<boolean>(false);
  const launchAngle = useSharedValue(0);

  // Initialize game
  useEffect(() => {
    initializeGame();
    return () => {
      if (gameLoop.current) cancelAnimationFrame(gameLoop.current);
    };
  }, []);

  const getBrickRowsForLevel = (level: number) => {
    return INITIAL_BRICK_ROWS + Math.floor(level / 2); // Add a row every 2 levels
  };

  const initializeGame = useCallback((level: number = 1) => {
    // Reset ball position
    lastBallX.current = INITIAL_LAUNCH_X;

    // Initialize balls
    const initialBalls: Ball[] = Array.from({ length: ballCount }, (_, i) => ({
      id: i,
      x: INITIAL_LAUNCH_X,
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    }));

    setBalls(initialBalls);
    setBricks([]);

    // Initialize bricks with random types and gaps
    const initialBricks: Brick[] = [];
    let brickId = 0;
    const rowsForLevel = getBrickRowsForLevel(level);

    for (let row = 0; row < rowsForLevel; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        // Reduce gap probability as levels increase
        const gapProbability = Math.max(0.1, 0.3 - (level * 0.05));
        if (Math.random() < gapProbability) continue;

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
          id: brickId++,
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

    setBricks(initialBricks);
    setGameState({ level, gameStatus: 'playing' });
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
    
    // Simple angle calculation: from ball position to touch point
    const dx = touchX - lastBallX.current;
    const dy = (touchY - LAUNCH_Y); // Negative because y increases downward
    let angle = Math.atan2(dy, dx);
    
    // Restrict to upward angles only (between -80 and 80 degrees)
    const maxAngle = (180 * Math.PI) / 180; // 80 degrees in radians
    angle = Math.max(-maxAngle, Math.min(maxAngle, angle));
    
    launchAngle.value = angle;
    touchActive.current = true;
  }, [isGameActive]);

  const onGestureEnd = useCallback(() => {
    if (!isGameActive || !touchActive.current) return;
    touchActive.current = false;

    // Use the same angle for launch
    const angle = launchAngle.value;
    const dx = Math.cos(angle) * BALL_SPEED;
    const dy = Math.sin(angle) * BALL_SPEED;

    // Create launch queue with proper velocities
    const unlaunched = balls.filter(ball => !ball.launched);
    if (unlaunched.length > 0) {
      launchQueue.current = unlaunched.map(ball => ({
        ...ball,
        dx,
        dy
      }));
      
      isLaunching.current = true;
      lastLaunchTime.current = performance.now() - LAUNCH_DELAY;
    }
  }, [balls, isGameActive]);

  // Animated style for the direction indicator
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${launchAngle.value}rad` }
    ]
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

  // Check if all balls have returned and move bricks down
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const allBallsReturned = balls.every(ball => !ball.launched);
    const visibleBricks = bricks.filter(brick => brick.visible);
    
    if (allBallsReturned && !isLaunching.current) {
      // Only check for win if we have bricks and all are cleared
      if (bricks.length > 0 && visibleBricks.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: 'won' }));
        return;
      }

      // Only move bricks if there are still some visible
      if (visibleBricks.length > 0) {
        setBricks(prevBricks => {
          const newBricks = prevBricks.map(brick => ({
            ...brick,
            y: brick.y + BRICK_DROP_AMOUNT
          }));

          // Check for loss (any visible brick below loss line)
          if (newBricks.some(brick => brick.visible && brick.y > LOSS_LINE)) {
            setGameState(prev => ({ ...prev, gameStatus: 'lost' }));
          }
          return newBricks;
        });
      }
    }
  }, [gameState.gameStatus, isLaunching.current]);

  const startNextLevel = () => {
    initializeGame(gameState.level + 1);
  };

  const restartGame = () => {
    initializeGame(1);
  };

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
          {/* Direction Indicator */}
          {touchActive.current && (
            <View style={styles.directionIndicatorContainer}>
              <Animated.View
                  style={[
                    styles.directionIndicatorDash,
                    {
                      left: lastBallX.current,
                      top: LAUNCH_Y,
                      transform: [
                        { rotate: `${launchAngle.value}rad` }
                      ],
                    },
                  ]}
                />
            </View>
          )}

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

          {/* Balls */}
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
                  backgroundColor: '#fff',
                  borderWidth: 2,
                  borderColor: '#000',
                },
              ]}
            />
          ))}
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

      {/* Level Complete Modal */}
      <Modal
        transparent={true}
        visible={gameState.gameStatus === 'won'}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Level {gameState.level} Complete!</Text>
            <Text style={styles.modalScore}>Score: {score}</Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={startNextLevel}
            >
              <Text style={styles.modalButtonText}>Next Level</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Game Over Modal */}
      <Modal
        transparent={true}
        visible={gameState.gameStatus === 'lost'}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Game Over</Text>
            <Text style={styles.modalScore}>Final Score: {score}</Text>
            <Text style={styles.modalLevel}>Made it to Level {gameState.level}</Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={restartGame}
            >
              <Text style={styles.modalButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
  directionIndicatorContainer: {
    position: 'absolute',
    height: 0, // Line thickness is controlled by borderWidth
    width: 100, // Adjust length as needed
    transformOrigin: 'left',
    zIndex: 1000,
  },
  directionIndicatorDash: {
    position: 'absolute',
    height: 0, // Line thickness is controlled by borderWidth
    width: 250, // Adjust length as needed
    borderWidth: 1, // Thickness of the dashed line
    borderColor: 'rgba(255, 255, 255, 0.25)', // Line color
    borderStyle: 'dotted', // Make it dashed
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalScore: {
    color: '#4CAF50',
    fontSize: 20,
    marginBottom: 10,
  },
  modalLevel: {
    color: '#888',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default BallBlasterGame;

