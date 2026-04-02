import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  variant?: 'circle' | 'rect' | 'text';
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({ 
  className = '', 
  variant = 'rect', 
  width, 
  height 
}: SkeletonProps) {
  const baseStyles = "bg-primary/5 relative overflow-hidden";
  const variantStyles = {
    circle: "rounded-full",
    rect: "rounded-3xl",
    text: "rounded-lg h-4 w-full"
  };

  return (
    <motion.div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    >
      <motion.div
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent"
      />
    </motion.div>
  );
}

export function CustomerCardSkeleton() {
  return (
    <div className="p-8 rounded-[3rem] bg-white border border-primary/5 shadow-premium space-y-6">
      <div className="flex items-center gap-6">
        <Skeleton variant="rect" width={64} height={64} className="rounded-2xl" />
        <div className="space-y-2">
          <Skeleton variant="text" width={100} />
          <Skeleton variant="text" width={60} />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-8">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white p-8 rounded-[3rem] border border-primary/5 shadow-sm space-y-4">
          <Skeleton variant="text" width={60} />
          <Skeleton variant="text" width={100} height={40} />
          <Skeleton variant="text" width={40} />
        </div>
      ))}
    </div>
  );
}
