"use client";

import { motion } from "framer-motion";

const STEPS = [
  "reading your handwriting",
  "tracing letter shapes",
  "building font glyphs",
  "assembling your font",
];

interface ProcessingAnimationProps {
  step?: number;
}

export default function ProcessingAnimation({ step = 0 }: ProcessingAnimationProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-8 py-16"
    >
      {/* Animated dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-fg/40"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Step text */}
      <div className="text-center space-y-4">
        {STEPS.map((text, i) => (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: i <= step ? 1 : 0.15,
              y: 0,
            }}
            transition={{ delay: i * 0.3, duration: 0.4 }}
            className="text-xs tracking-wide text-fg/60"
          >
            {i < step ? (
              <span className="text-fg/80">&#10003; {text}</span>
            ) : i === step ? (
              <span className="text-fg">{text}...</span>
            ) : (
              text
            )}
          </motion.p>
        ))}
      </div>
    </motion.div>
  );
}
