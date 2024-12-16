# Ball Blaster

A cyberpunk-themed brick breaker game built with React Native and Expo.

## Features

- Multiple levels with different brick patterns
- Special bricks that give extra balls
- Score tracking and level progression
- Smooth ball physics and collision detection
- Cyberpunk visual style
- Touch controls with angle indicator

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development)
- Android Studio & Android SDK (for Android development)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd BallBlaster
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

## Running the App

### Development

1. Start the Expo development server:
```bash
npm start
# or
yarn start
```

2. Run on specific platform:
- iOS:
```bash
npm run ios
# or
yarn ios
```

- Android:
```bash
npm run android
# or
yarn android
```

### Building for Production

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Build for iOS/Android:
```bash
eas build --platform ios
# or
eas build --platform android
```

## Project Structure

- `GameScreen.tsx` - Main game component with game logic
- `levels.json` - Level definitions and brick patterns
- `assets/` - Game assets (icons, splash screens)

## Technologies Used

- React Native
- Expo
- React Native Reanimated
- React Native Gesture Handler

## License

This project is licensed under the 0BSD License - see the LICENSE file for details. 