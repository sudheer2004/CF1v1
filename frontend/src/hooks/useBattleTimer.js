import { useState, useEffect, useRef } from 'react';

export const useBattleTimer = (activeBattle) => {
  const [matchTimer, setMatchTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (
      !activeBattle ||
      activeBattle.status !== "active" ||
      !activeBattle.endTime
    ) {
      setMatchTimer(0);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(
        0,
        Math.floor((new Date(activeBattle.endTime).getTime() - now) / 1000)
      );
      return remaining;
    };

    setMatchTimer(calculateRemaining());

    timerRef.current = setInterval(() => {
      const remaining = calculateRemaining();
      setMatchTimer(remaining);

      if (remaining === 0) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeBattle?.endTime, activeBattle?.status]);

  return matchTimer;
};