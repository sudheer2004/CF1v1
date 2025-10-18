import { useState, useEffect, useRef } from 'react';

export const useTeamBattleState = (activeBattle, user) => {
  const [mode, setMode] = useState("menu");
  const [isCreator, setIsCreator] = useState(false);
  const initialModeSet = useRef(false);

  // Determine initial mode based on props (instant restore)
  useEffect(() => {
    if (initialModeSet.current) return;

    if (activeBattle) {
      // console.log("📥 TeamBattle: Using battle from props (instant restore)");
      setIsCreator(activeBattle.creatorId === user.id);

      if (activeBattle.status === "waiting") {
        setMode("waiting");
      } else if (activeBattle.status === "active") {
        setMode("match");
      }

      initialModeSet.current = true;
    }
  }, [activeBattle, user.id]);

  const resetState = () => {
    setMode("menu");
    initialModeSet.current = false;
  };

  return {
    mode,
    setMode,
    isCreator,
    setIsCreator,
    resetState,
  };
};