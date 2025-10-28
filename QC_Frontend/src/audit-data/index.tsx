import { StageData } from '../types/audit';
import { preLamStage } from './stage1';
import { autoFrontGlassStage } from './stage2';
import { frontEncapsulantStage } from './stage3';
import { cellSortingStage } from './stage4';
import { tabbingStringingStage } from './stage5';

export const initialStages: StageData[] = [
    preLamStage,
    autoFrontGlassStage,
    frontEncapsulantStage,
    cellSortingStage,
    tabbingStringingStage
];