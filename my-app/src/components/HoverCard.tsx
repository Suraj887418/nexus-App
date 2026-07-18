import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

interface HoverCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | any;
  hoverStyle?: StyleProp<ViewStyle> | any;
  onPress?: () => void;
}

const HoverCard: React.FC<HoverCardProps> = ({ children, style, hoverStyle, onPress }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Pressable
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        isHovered && hoverStyle,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
      ]}
    >
      {children}
    </Pressable>
  );
};

export default HoverCard;
