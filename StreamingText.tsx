import React, { useState, useEffect } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';

interface StreamingTextProps {
  text: string;
  onComplete?: () => void;
}

const StreamingText: React.FC<StreamingTextProps> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
    fadeAnim.setValue(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      // Vary the speed slightly for a more natural feel
      const speed = 30 + Math.random() * 20; // 30-50ms per character
      
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(i => i + 1);
        
        // Fade in each character
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, speed);

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.text}>
        {displayedText}
        <Text style={styles.cursor}>|</Text>
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
  },
  text: {
    color: '#00ff00',
    fontSize: 18,
    fontFamily: 'monospace',
    textShadowColor: '#00ff00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    lineHeight: 24,
  },
  cursor: {
    opacity: 0.7,
  },
});

export default StreamingText; 