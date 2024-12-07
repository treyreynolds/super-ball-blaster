// BallBlasterGame.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, Modal, Animated as RNAnimated, TextInput } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { PRESET_SUBJECTS, SubjectOption } from './dummyFacts';
import StreamingText from './StreamingText';

const { width, height } = Dimensions.get('window');

// ----------------- CONSTANTS & TYPES -----------------
const BALL_RADIUS = 8;
const BALL_SPEED_PER_SEC = 600; // Approx. 12 px/frame at 60fps -> now consistent with deltaTime
const LAUNCH_DELAY = 150;       // ms delay between launching balls
const BRICK_MARGIN = 3;
const INITIAL_BRICK_ROWS = 4;
const BRICK_COLS = 8;
const HEADER_HEIGHT = 80;
const BOTTOM_CONTROLS_HEIGHT = 80;
const BRICK_WIDTH = (width - (BRICK_COLS + 1) * BRICK_MARGIN) / BRICK_COLS;
const BRICK_HEIGHT = 25;
const LAUNCH_Y = height - BOTTOM_CONTROLS_HEIGHT - 100;
const INITIAL_LAUNCH_X = width / 2;
const BRICK_DROP_AMOUNT = 40;
const LOSS_LINE = LAUNCH_Y - BRICK_HEIGHT * 2;

interface Ball {
  id: number;
  x: number;
  y: number;
  dx: number;   // Velocity in x (px/s)
  dy: number;   // Velocity in y (px/s)
  launched: boolean;
}

interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  hits: number;
  color: string;
  points: number;
  givesBall?: boolean;
}

type BrickType = {
  color: string;
  points: number;
  hits: number;
  probability: number;
  givesBall?: boolean;
};

const BRICK_TYPES: BrickType[] = [
  { color: '#4CAF50', points: 1, hits: 1, probability: 0.6 },    // Common green
  { color: '#2196F3', points: 2, hits: 2, probability: 0.25 },   // Blue
  { color: '#FFC107', points: 1, hits: 1, probability: 0.1, givesBall: true },   // Special yellow
  { color: '#9C27B0', points: 5, hits: 3, probability: 0.05 },   // Rare purple
];

interface GameState {
  level: number;
  gameStatus: 'playing' | 'won' | 'lost';
}

// ----------------- MAIN COMPONENT -----------------
const BallBlasterGame: React.FC = () => {
  // ----------------- REFS & STATE -----------------
  const gameLoop = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(0);

  const isLaunching = useRef<boolean>(false);
  const launchQueue = useRef<Ball[]>([]);
  const lastLaunchTime = useRef<number>(0);
  const lastBallX = useRef<number>(INITIAL_LAUNCH_X);

  const [balls, setBalls] = useState<Ball[]>([]);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [score, setScore] = useState(0);
  const [ballCount, setBallCount] = useState(10);
  const [isGameActive, setIsGameActive] = useState(true);
  const [gameState, setGameState] = useState<GameState>({ level: 1, gameStatus: 'playing' });

  const touchActive = useRef<boolean>(false);
  const launchAngle = useSharedValue(0);

  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [showSubjectSelect, setShowSubjectSelect] = useState(true);
  const [currentFacts, setCurrentFacts] = useState<string[]>([]);
  const [displayedFactIndex, setDisplayedFactIndex] = useState(0);

  const [isStreaming, setIsStreaming] = useState(false);

  const [overlayFadeAnim] = useState(new RNAnimated.Value(1));

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubject(subjectId);
    const subject = PRESET_SUBJECTS.find(s => s.id === subjectId);
    if (subject) {
      setCurrentFacts(subject.dummyFacts);
    }
    setShowSubjectSelect(false);
  };

  // Add function to handle custom subject
  const handleCustomSubject = () => {
    if (customSubject.trim()) {
      setSelectedSubject('custom');
      setCurrentFacts([
        `Custom fact about ${customSubject} #1`,
        `Custom fact about ${customSubject} #2`,
        `Custom fact about ${customSubject} #3`,
      ]);
      setShowSubjectSelect(false);
    }
  };

  // ----------------- EFFECTS -----------------
  useEffect(() => {
    initializeGame();
    return () => {
      if (gameLoop.current) cancelAnimationFrame(gameLoop.current);
    };
  }, []);

  useEffect(() => {
    if (isLaunching.current && currentFacts.length > 0) {
      return () => {};
    }
  }, [isLaunching.current, currentFacts]);

  // ----------------- GAME INITIALIZATION -----------------
  const getBrickRowsForLevel = (level: number) => {
    return INITIAL_BRICK_ROWS + Math.floor(level / 2);
  };

  const initializeGame = useCallback((level: number = 1) => {
    // Reset turn and launching states
    isLaunching.current = false;
    lastTurnHadLaunch.current = false;
    launchQueue.current = [];
    lastFrameTime.current = 0; // Resetting frame time reference
    if (gameLoop.current) {
      cancelAnimationFrame(gameLoop.current);
      gameLoop.current = null;
    }
  
    // Reset ball position and state
    lastBallX.current = INITIAL_LAUNCH_X;
  
    const initialBalls: Ball[] = Array.from({ length: ballCount }, (_, i) => ({
      id: i,
      x: INITIAL_LAUNCH_X,
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    }));
  
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
          hits: selectedType.hits,
          color: selectedType.color,
          points: selectedType.points,
          givesBall: selectedType.givesBall
        });
      }
    }

    setBricks(initialBricks);
    setBalls(initialBalls);
    setGameState({ level, gameStatus: 'playing' });
    
    // Restart the game loop
    startGameLoop();
  }, [ballCount]);

  // ----------------- GAME LOOP -----------------
  const startGameLoop = useCallback(() => {
    const updateGame = (timestamp: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = timestamp;
      const deltaTime = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;

      handleQueuedLaunches(timestamp);
      updateBallsAndBricks(deltaTime);

      gameLoop.current = requestAnimationFrame(updateGame);
    };

    gameLoop.current = requestAnimationFrame(updateGame);
  }, []);

  // Handle launching balls in queue
  const handleQueuedLaunches = (timestamp: number) => {
    if (isLaunching.current && launchQueue.current.length > 0) {
      const currentTime = timestamp;
      if (currentTime - lastLaunchTime.current >= LAUNCH_DELAY) {
        const [ballToLaunch, ...rest] = launchQueue.current;
        launchQueue.current = rest;
        setBalls(prev => {
          const idx = prev.findIndex(b => b.id === ballToLaunch.id);
          if (idx !== -1) {
            const newBalls = [...prev];
            newBalls[idx] = { ...ballToLaunch, launched: true };
            return newBalls;
          }
          return prev;
        });
        lastLaunchTime.current = currentTime;
      }
    }
  };

  // Update balls and handle collisions with walls and bricks
  const updateBallsAndBricks = (deltaTime: number) => {
    const deltaSec = deltaTime / 1000;

    setBalls(prevBalls => {
      const newBalls = [...prevBalls];
      let allBallsReturned = true;

      setBricks(prevBricks => {
        const updatedBricks = [...prevBricks];
        let bricksUpdated = false;

        for (let i = 0; i < newBalls.length; i++) {
          const ball = newBalls[i];
          if (!ball.launched) continue;
          allBallsReturned = false;

          const { newX, newY, collidedWithBrick, brickIndex } = updateBallPosition(ball, deltaSec, updatedBricks);

          // If ball returned to bottom
          if (newY + BALL_RADIUS >= height - BOTTOM_CONTROLS_HEIGHT) {
            lastBallX.current = newX;
            newBalls[i] = { ...ball, x: lastBallX.current, y: LAUNCH_Y, launched: false };
            continue;
          }

          // Update brick if collision occurred
          if (collidedWithBrick && brickIndex !== null && updatedBricks[brickIndex]) {
            const brick = updatedBricks[brickIndex];
            brick.hits--;
            if (brick.hits <= 0) {
              brick.visible = false;
              bricksUpdated = true;
              setScore(prev => prev + brick.points);
              if (brick.givesBall) {
                setBallCount(prev => prev + 1);
              }
            }
            updatedBricks[brickIndex] = brick;
          }

          // Update ball position
          newBalls[i] = { ...ball, x: newX, y: newY };
        }

        // Only end the turn if streaming is complete
        if (allBallsReturned && isLaunching.current && !isStreaming) {
          endTurn(newBalls);
        }

        return bricksUpdated ? updatedBricks : prevBricks;
      });

      return newBalls;
    });
  };

  const endTurn = (updatedBalls: Ball[]) => {
    isLaunching.current = false;
    launchQueue.current = [];
    updatedBalls.forEach(ball => {
      ball.x = lastBallX.current;
    });
  };

  const updateBallPosition = (
    ball: Ball,
    deltaSec: number,
    updatedBricks: Brick[]
  ): { newX: number; newY: number; collidedWithBrick: boolean; brickIndex: number | null } => {
    // Apply velocity with deltaTime for consistent movement speed
    let newX = ball.x + ball.dx * deltaSec;
    let newY = ball.y + ball.dy * deltaSec;

    // Collision with walls
    if (newX - BALL_RADIUS <= 0 || newX + BALL_RADIUS >= width) {
      const newDx = -ball.dx;
      newX = ball.x + newDx * deltaSec;
      ball.dx = newDx;
    }

    if (newY - BALL_RADIUS <= 0) {
      const newDy = -ball.dy;
      newY = ball.y + newDy * deltaSec;
      ball.dy = newDy;
    }

    // Check brick collision
    let collidedWithBrick = false;
    let brickIndex: number | null = null;
    for (let j = 0; j < updatedBricks.length && !collidedWithBrick; j++) {
      const brick = updatedBricks[j];
      if (!brick.visible) continue;

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

        // Bounce direction
        if (minOverlap === fromLeft || minOverlap === fromRight) {
          ball.dx = -ball.dx;
          newX = ball.x + ball.dx * deltaSec;
        } else {
          ball.dy = -ball.dy;
          newY = ball.y + ball.dy * deltaSec;
        }

        collidedWithBrick = true;
        brickIndex = j;
      }
    }

    return { newX, newY, collidedWithBrick, brickIndex };
  };

  // Recall all balls
  const recallBalls = useCallback(() => {
    setBalls(prev => prev.map(ball => ({
      ...ball,
      x: lastBallX.current,
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    })));
    isLaunching.current = false;
    launchQueue.current = [];
  }, []);

  // ----------------- TOUCH & GESTURE HANDLERS -----------------
  const onGestureEvent = useCallback((event: any) => {
    if (!isGameActive) return;

    const touchX = event.nativeEvent.x;
    const touchY = event.nativeEvent.y;

    // Calculate angle from launcher position to touch
    const dx = touchX - lastBallX.current;
    const dy = (touchY - LAUNCH_Y);
    let angle = Math.atan2(dy, dx);

    // Limit angle to a forward/upward range
    const maxAngle = Math.PI; // adjust if you want narrower angles
    angle = Math.max(-maxAngle, Math.min(maxAngle, angle));

    launchAngle.value = angle;
    touchActive.current = true;
  }, [isGameActive]);

  const lastTurnHadLaunch = useRef<boolean>(false);

  const onGestureEnd = useCallback(() => {
    if (!isGameActive || !touchActive.current || balls.some(ball => ball.launched)) return;
    
    touchActive.current = false;

    const allBallsReturned = balls.every(ball => !ball.launched);
    if (isLaunching.current || !allBallsReturned) {
      return;
    }

    const angle = launchAngle.value;
    const dx = Math.cos(angle) * BALL_SPEED_PER_SEC;
    const dy = Math.sin(angle) * BALL_SPEED_PER_SEC;

    const unlaunched = balls.filter(ball => !ball.launched);
    if (unlaunched.length > 0) {
      lastTurnHadLaunch.current = true;
      setIsStreaming(true); // Set streaming to true when launching

      launchQueue.current = unlaunched.map(ball => ({ ...ball, dx, dy }));
      isLaunching.current = true;
      lastLaunchTime.current = performance.now() - LAUNCH_DELAY;
    }
  }, [balls, isGameActive]);

  // ----------------- CHECK TURN END & LEVEL PROGRESSION -----------------
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const allBallsReturned = balls.every(ball => !ball.launched);
    const visibleBricks = bricks.filter(brick => brick.visible);

    // Only do end-of-turn logic if a turn actually occurred
    if (allBallsReturned && !isLaunching.current && lastTurnHadLaunch.current) {
      // Reset the turn flag
      lastTurnHadLaunch.current = false;

      // Check if player cleared the level
      if (bricks.length > 0 && visibleBricks.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: 'won' }));
        return;
      }

      // Move bricks down if any are still visible
      if (visibleBricks.length > 0) {
        setBricks(prevBricks => {
          const newBricks = prevBricks.map(brick => ({
            ...brick,
            y: brick.y + BRICK_DROP_AMOUNT
          }));

          // Check for loss condition
          if (newBricks.some(b => b.visible && b.y > LOSS_LINE)) {
            setGameState(prev => ({ ...prev, gameStatus: 'lost' }));
          }
          return newBricks;
        });
      }
    }
  }, [gameState.gameStatus, isLaunching.current, balls, bricks]);

  // ----------------- LEVEL & GAME RESETS -----------------
  const startNextLevel = () => {
    initializeGame(gameState.level + 1);
  };

  const restartGame = () => {
    initializeGame(1);
  };

  // ----------------- ANIMATED STYLES -----------------
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${launchAngle.value}rad` }]
  }));

  const allBallsReturned = balls.every(ball => !ball.launched);
  const canLaunch = isGameActive && !isLaunching.current && allBallsReturned;

  // ----------------- RENDER -----------------
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

      {showSubjectSelect && (
        <View style={styles.subjectSelectionContainer}>
          <Text style={styles.subjectSelectionTitle}>SELECT YOUR SUBJECT</Text>
          {PRESET_SUBJECTS.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={[
                styles.subjectButton,
                selectedSubject === subject.id && styles.subjectButtonSelected,
              ]}
              onPress={() => handleSubjectSelect(subject.id)}
            >
              <Text
                style={[
                  styles.subjectButtonText,
                  selectedSubject === subject.id && styles.subjectButtonTextSelected,
                ]}
              >
                {subject.name}
              </Text>
            </TouchableOpacity>
          ))}
          
        </View>
      )}

      {(isLaunching.current || isStreaming) && currentFacts[displayedFactIndex] && (
        <RNAnimated.View 
          style={[
            styles.cyberOverlay,
            { opacity: overlayFadeAnim }
          ]}
        >
          <View style={styles.factContainer}>
            <StreamingText 
              text={currentFacts[displayedFactIndex]}
              onComplete={() => {
                // Wait 1 second, then fade out
                setTimeout(() => {
                  RNAnimated.timing(overlayFadeAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                  }).start(() => {
                    setIsStreaming(false);
                    overlayFadeAnim.setValue(1); // Reset for next timre
                    // Update fact index after fade completes
                    setTimeout(() => {
                      setDisplayedFactIndex(prev => 
                        prev < currentFacts.length - 1 ? prev + 1 : prev
                      );
                    }, 0);
                  });
                }, 1000);
              }}
            />
          </View>
        </RNAnimated.View>
      )}

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
              <RNAnimated.View
                style={[
                  styles.directionIndicatorDash,
                  {
                    left: lastBallX.current,
                    top: LAUNCH_Y,
                    transform: [{ rotate: `${launchAngle.value}rad` }],
                    borderColor: canLaunch ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 0, 0, 0.5)',
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
                    opacity: 1,
                  },
                ]}
              >
                <Text style={[styles.brickText, { 
                  color: brick.hits >= 4 ? '#fff' : '#000',
                  opacity: brick.hits >= 4 ? 1 : 0.8,
                }]}>
                  {brick.hits}
                </Text>
              </View>
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


// ----------------- STYLES -----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a20', // Deep blue-black background
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(41, 21, 71, 0.9)', // Purple tint
    borderBottomWidth: 2,
    borderBottomColor: '#ff2d55', // Neon pink
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  scoreSection: {
    alignItems: 'center',
  },
  ballSection: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#8a8aff', // Soft blue
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: '#8a8aff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: '#ff2d55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ballLabel: {
    color: '#8a8aff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: '#8a8aff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ballValue: {
    color: '#00ff9f', // Neon green
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: '#00ff9f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#0a0a20',
  },
  ball: {
    position: 'absolute',
    borderRadius: BALL_RADIUS,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ff2d55',
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  brick: {
    position: 'absolute',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 5,
  },
  directionIndicatorContainer: {
    position: 'absolute',
    height: 0,
    width: 100,
    transformOrigin: 'left',
    zIndex: 1000,
  },
  directionIndicatorDash: {
    position: 'absolute',
    height: 0,
    width: 250,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.6)', // Neon pink with transparency
    borderStyle: 'dotted',
    transformOrigin: 'left',
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    zIndex: 1000,
  },
  bottomControls: {
    height: BOTTOM_CONTROLS_HEIGHT,
    backgroundColor: 'rgba(41, 21, 71, 0.9)', // Purple tint
    borderTopWidth: 2,
    borderTopColor: '#ff2d55', // Neon pink
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 20,
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 45, 85, 0.2)', // Neon pink with high transparency
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ff2d55',
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: '#ff2d55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  buttonPlaceholder: {
    width: 80,
    height: 42,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 32, 0.9)', // Dark blue-black with transparency
  },
  modalContent: {
    backgroundColor: 'rgba(41, 21, 71, 0.95)', // Purple tint
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff2d55',
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textShadowColor: '#ff2d55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  modalScore: {
    color: '#00ff9f', // Neon green
    fontSize: 20,
    marginBottom: 10,
    textShadowColor: '#00ff9f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  modalLevel: {
    color: '#8a8aff',
    fontSize: 16,
    marginBottom: 20,
    textShadowColor: '#8a8aff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  modalButton: {
    backgroundColor: 'rgba(0, 255, 159, 0.2)', // Neon green with transparency
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#00ff9f',
    shadowColor: '#00ff9f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: '#00ff9f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  cyberOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 32, 0.3)', // Dark blue-black with low opacity
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  brickText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: BRICK_HEIGHT,
  },
  subjectSelectionContainer: {
    display: 'flex',
    flex: 1,
    backgroundColor: '#0a0a20',
    padding: 40,
    justifyContent: 'center',
  },
  subjectSelectionTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingBottom: 30,
    textShadowColor: '#ff2d55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    paddingTop: 60,
  },
  subjectButton: {
    backgroundColor: 'rgba(41, 21, 71, 0.9)',
    padding: 20,
    borderRadius: 15,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#8a8aff',
    shadowColor: '#8a8aff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  subjectButtonSelected: {
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
    borderColor: '#ff2d55',
    shadowColor: '#ff2d55',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  subjectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#8a8aff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  subjectButtonTextSelected: {
    textShadowColor: '#ff2d55',
    textShadowRadius: 8,
  },
  startButton: {
    backgroundColor: 'rgba(0, 255, 159, 0.2)',
    padding: 20,
    borderRadius: 25,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#00ff9f',
    shadowColor: '#00ff9f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#00ff9f',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  factContainer: {
    position: 'absolute',
    top: HEADER_HEIGHT + 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 20, 0, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff00',
    shadowColor: '#00ff00',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
});

export default BallBlasterGame;