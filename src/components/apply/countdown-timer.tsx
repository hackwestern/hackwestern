"use client";
import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: string; // ISO string, e.g. "2025-12-31T23:59:59"
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    if (difference <= 0) return null;

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return { days, hours, minutes, seconds };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft)
    return (
      <p className="text-2xl font-medium text-medium">🎉 Time&apos;s up!</p>
    );

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <p className="text-2xl font-medium text-medium">
      {days}d {hours}h {minutes}m {seconds}s left
    </p>
  );
}
