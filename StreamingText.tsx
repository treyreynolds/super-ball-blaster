import React, { useState, useEffect } from 'react';
import { Text, Animated, StyleSheet, View } from 'react-native';

interface StreamingTextProps {
  text: string;
  onComplete?: () => void;
}

const StreamingText: React.FC<StreamingTextProps> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const speed = 30 + Math.random() * 20;
      
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(i => i + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {displayedText}
        <Text style={styles.cursor}>|</Text>
      </Text>
    </View>
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