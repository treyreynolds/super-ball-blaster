import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, Modal, Animated as RNAnimated } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import levelsData from './levels.json';

// ----------------- CONSTANTS & TYPES -----------------
const DESIGN_WIDTH = 320;
const DESIGN_HEIGHT = 480;

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

// Maintain aspect ratio for the game area
let gameAreaWidth = deviceWidth;
let gameAreaHeight = (deviceWidth / DESIGN_WIDTH) * DESIGN_HEIGHT;
if (gameAreaHeight > deviceHeight) {
  gameAreaHeight = deviceHeight;
  gameAreaWidth = (deviceHeight / DESIGN_HEIGHT) * DESIGN_WIDTH;
}

// Scale factor based on our design
const scaleX = gameAreaWidth / DESIGN_WIDTH;
const scaleY = gameAreaHeight / DESIGN_HEIGHT;
// If you want uniform scaling, choose the smaller one so everything fits.
const scale = Math.min(scaleX, scaleY);

// Define some scaled constants based on the design space
const BALL_RADIUS = 4 * scale;
const BALL_SPEED_PER_SEC = 600 * scale;
const LAUNCH_DELAY = 150; // ms
const BRICK_MARGIN = 2 * scale;
const HEADER_HEIGHT = 60 * scale;
const BOTTOM_CONTROLS_HEIGHT = 60 * scale;
const LAUNCH_Y = deviceHeight - BOTTOM_CONTROLS_HEIGHT - (BALL_RADIUS * 2) - 100;
const INITIAL_LAUNCH_X = deviceWidth / 2;
const BRICK_DROP_AMOUNT = 40 * scale;
const LOSS_LINE = deviceHeight - BOTTOM_CONTROLS_HEIGHT - (deviceHeight * 0.3);

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
  shape: 'sqr' | 'tr1' | 'tr2' | 'tr3' | 'tr4' | 'circle' | 'bla';
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

interface GameState {
  level: number;
  gameStatus: 'playing' | 'won' | 'lost';
}

const BallBlasterGame: React.FC = () => {
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

  useEffect(() => {
    initializeGame(1);
    return () => {
      if (gameLoop.current) cancelAnimationFrame(gameLoop.current);
    };
  }, []);

  const initializeGame = useCallback((level: number) => {
    isLaunching.current = false;
    lastTurnHadLaunch.current = false;
    launchQueue.current = [];
    lastFrameTime.current = 0;
    if (gameLoop.current) {
      cancelAnimationFrame(gameLoop.current);
      gameLoop.current = null;
    }

    lastBallX.current = INITIAL_LAUNCH_X;

    const initialBalls: Ball[] = Array.from({ length: ballCount }, (_, i) => ({
      id: i,
      x: INITIAL_LAUNCH_X,
      y: LAUNCH_Y,
      dx: 0,
      dy: 0,
      launched: false
    }));

    // Load level data from JSON
    const levelData = levelsData.levels[level - 1];
    if (!levelData) {
      setGameState({ level, gameStatus: 'won' });
      return;
    }

    const rows = levelData.rows;
    const maxRowLength = Math.max(...rows.map(r => r.length));
    // Compute brick size based on the design width and margin
    const designBrickWidth = (DESIGN_WIDTH - (maxRowLength + 1) * 3) / maxRowLength;
    const designBrickHeight = 25;

    const brickWidth = designBrickWidth * scale;
    const brickHeight = designBrickHeight * scale;

    let brickId = 0;
    const initialBricks: Brick[] = [];

    rows.forEach((rowBricks, rowIndex) => {
      rowBricks.forEach((brickDef, colIndex) => {
        const x = (colIndex * (brickWidth + BRICK_MARGIN) + BRICK_MARGIN);
        const y = (rowIndex * (brickHeight + BRICK_MARGIN) + HEADER_HEIGHT);
        initialBricks.push({
          id: brickId++,
          shape: brickDef.shape || 'square',
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          visible: true,
          hits: brickDef.hits,
          color: brickDef.color,
          points: brickDef.points,
          givesBall: brickDef.givesBall
        });
      });
    });

    setBricks(initialBricks);
    setBalls(initialBalls);
    setGameState({ level, gameStatus: 'playing' });
    startGameLoop();
  }, [ballCount]);

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

          if (newY >= LAUNCH_Y) {
            lastBallX.current = newX;
            newBalls[i] = { ...ball, x: newX, y: LAUNCH_Y, launched: false };
            continue;
          }

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

          newBalls[i] = { ...ball, x: newX, y: newY };
        }

        if (allBallsReturned && isLaunching.current) {
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
    let newX = ball.x + ball.dx * deltaSec;
    let newY = ball.y + ball.dy * deltaSec;

    // Walls
    if (newX - BALL_RADIUS <= 0 || newX + BALL_RADIUS >= deviceWidth) {
      const newDx = -ball.dx;
      newX = ball.x + newDx * deltaSec;
      ball.dx = newDx;
    }

    if (newY - BALL_RADIUS <= HEADER_HEIGHT) {
      const newDy = -ball.dy;
      newY = ball.y + newDy * deltaSec;
      ball.dy = newDy;
    }

    // Bottom return check
    if (newY >= LAUNCH_Y) {
      return { newX, newY: LAUNCH_Y, collidedWithBrick: false, brickIndex: null };
    }

    // Bricks
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
        const fromLeft = Math.abs((newX + BALL_RADIUS) - brick.x);
        const fromRight = Math.abs((newX - BALL_RADIUS) - (brick.x + brick.width));
        const fromTop = Math.abs((newY + BALL_RADIUS) - brick.y);
        const fromBottom = Math.abs((newY - BALL_RADIUS) - (brick.y + brick.height));
        const minOverlap = Math.min(fromLeft, fromRight, fromTop, fromBottom);

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

  const onGestureEvent = useCallback((event: any) => {
    if (!isGameActive) return;
    const touchX = event.nativeEvent.x;
    const touchY = event.nativeEvent.y;

    const dx = touchX - lastBallX.current;
    const dy = touchY - LAUNCH_Y;
    let angle = Math.atan2(dy, dx);
    const maxAngle = Math.PI;
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
      launchQueue.current = unlaunched.map(ball => ({ ...ball, dx, dy }));
      isLaunching.current = true;
      lastLaunchTime.current = performance.now() - LAUNCH_DELAY;
    }
  }, [balls, isGameActive]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const allBallsReturned = balls.every(ball => !ball.launched);
    const visibleBricks = bricks.filter(brick => brick.visible);

    if (allBallsReturned && !isLaunching.current && lastTurnHadLaunch.current) {
      lastTurnHadLaunch.current = false;

      // Check win
      if (bricks.length > 0 && visibleBricks.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: 'won' }));
        return;
      }

      // Move bricks down
      if (visibleBricks.length > 0) {
        setBricks(prevBricks => {
          const newBricks = prevBricks.map(brick => ({
            ...brick,
            y: brick.y + BRICK_DROP_AMOUNT
          }));

          if (newBricks.some(b => b.visible && b.y > LOSS_LINE)) {
            setGameState(prev => ({ ...prev, gameStatus: 'lost' }));
          }
          return newBricks;
        });
      }
    }
  }, [gameState.gameStatus, isLaunching.current, balls, bricks]);

  const startNextLevel = () => {
    initializeGame(gameState.level + 1);
  };

  const restartGame = () => {
    initializeGame(1);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${launchAngle.value}rad` }]
  }));

  const allBallsReturned = balls.every(ball => !ball.launched);
  const canLaunch = isGameActive && !isLaunching.current && allBallsReturned;

  const renderBrick = (brick: Brick) => {
    if (!brick.visible) return null;

    // For a right triangle (diagonal cut):
    // We'll create a diagonal right-angled triangle from top-left corner to bottom-right corner.
    // This uses border trick:
    // - borderRightWidth = brick.width
    // - borderBottomWidth = brick.height
    // - one color on bottom, transparent on right
    // This makes a right-angled triangle with right angle at top-left.

    return (
      <View
        key={brick.id}
        style={{
          position: 'absolute',
          left: brick.x,
          top: brick.y,
          width: brick.width,
          height: brick.height
        }}
      >
        {brick.shape === 'sqr' ? (
          <View style={{ flex: 1, backgroundColor: brick.color, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.brickText}>{brick.hits}</Text>
          </View>
        ) : brick.shape === 'tr1' ? (
          <View style={{ flex: 1 }}>
            {/* Triangle: right angle at top-left corner */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderRightWidth: brick.width,
              borderBottomWidth: brick.height,
              borderRightColor: 'transparent',
              borderBottomColor: brick.color
            }} />
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: brick.width,
              height: brick.height,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={styles.triangleText}>{brick.hits}</Text>
            </View>
          </View>
        ) : brick.shape === 'tr2' ? (
          <View style={{ flex: 1 }}>
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderRightWidth: brick.width,
              borderBottomWidth: brick.height,
              borderRightColor: 'transparent',
              borderBottomColor: brick.color
            }} />
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: brick.width,
              height: brick.height,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={styles.triangleText}>{brick.hits}</Text>
            </View>
          </View>
        ) : brick.shape === 'tr3' ? (
          <View style={{ flex: 1 }}>
            {/* Triangle: right angle at bottom-left corner */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderRightWidth: brick.width,
              borderBottomWidth: brick.height,
              borderRightColor: 'transparent',
              borderBottomColor: brick.color
            }} />
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: brick.width,
              height: brick.height,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={styles.triangleText}>{brick.hits}</Text>
            </View>
          </View>
        ) : brick.shape === 'bla' ? (
          <View style={{ flex: 1, backgroundColor: brick.color, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.brickText}>{brick.hits}</Text>
          </View>
        ) : null}
      </View>
    );
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
          {/* Launch direction indicator */}
          {touchActive.current && (
            <View
              style={[
                styles.directionIndicatorContainer,
                {
                  left: lastBallX.current,
                  top: LAUNCH_Y,
                }
              ]}
            >
              <View
                style={[
                  styles.directionIndicatorDash,
                  {
                    borderColor: canLaunch ? 'rgba(255,255,255,0.25)' : 'rgba(255,0,0,0.5)'
                  },
                  indicatorStyle
                ]}
              />
            </View>
          )}

          {/* Bricks */}
          {bricks.map(renderBrick)}

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
    backgroundColor: '#e8e8e8',
    justifyContent: 'space-between',
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  scoreSection: {
    alignItems: 'center',
  },
  ballSection: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#e8e8e8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  scoreValue: {
    color: '#e8e8e8',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  ballLabel: {
    color: '#e8e8e8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  ballValue: {
    color: '#e8e8e8',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#e8e8e8',
    alignSelf: 'stretch',
    position: 'relative',
  },
  ball: {
    position: 'absolute',
    borderRadius: BALL_RADIUS,
    backgroundColor: '#000000',
    borderWidth: 0,
  },
  brickText: {
    color: '#e8e8e8',
    fontWeight: 'bold',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  triangleText: {
    color: '#e8e8e8',
    fontWeight: 'bold',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  directionIndicatorContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  directionIndicatorDash: {
    position: 'relative',
    width: 150,
    borderWidth: 1,
    borderStyle: 'dotted',
    transformOrigin: '0 0',
  },
  bottomControls: {
    height: BOTTOM_CONTROLS_HEIGHT,
    backgroundColor: '#000000',
    borderTopWidth: 2,
    borderTopColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  controlButton: {
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#000000',
    minWidth: 70,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  buttonPlaceholder: {
    width: 70,
    height: 35,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#404040',
    backgroundColor: '#202020',
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000000',
  },
  modalTitle: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    fontFamily: 'monospace',
  },
  modalScore: {
    color: '#000000',
    fontSize: 16,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  modalLevel: {
    color: '#000000',
    fontSize: 14,
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  modalButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 0,
    marginTop: 10,
    borderWidth: 0,
  },
  modalButtonText: {
    color: '#e8e8e8',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});

export default BallBlasterGame;
