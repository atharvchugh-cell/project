// Solo game boundary: the engine hook and its return data load only here,
// so the homepage does not download them until a game starts.
import { useGameEngine, type GameState } from '@/hooks/useGameEngine';
import { GameScreen } from '@/components/game/GameScreen';
import { EndGameScreen } from '@/components/game/EndGameScreen';

export default function SoloGameWrapper({ onPlayAgain, onQuit, onSaveAndExit, duration, startYear, selectedStockIds, gameMode, resumedState, saveSlotId }: {
  onPlayAgain: () => void; onQuit: () => void; onSaveAndExit: () => void;
  duration: number; startYear?: number; selectedStockIds?: string[]; gameMode: 'normal' | 'complex' | 'hard';
  resumedState?: GameState;
  saveSlotId?: string;
}) {
  const engine = useGameEngine(undefined, startYear, duration, selectedStockIds, gameMode, resumedState, saveSlotId);
  if (engine.phase === 'ended') return <EndGameScreen engine={engine} onPlayAgain={onPlayAgain} />;
  return <GameScreen engine={engine} onQuit={onQuit} onSaveAndExit={onSaveAndExit} />;
}
