import { StageData } from '../types/audit';
import { preLamStage } from './stage1';
import { autoFrontGlassStage } from './stage2';
import { frontEncapsulantStage } from './stage3';
import { cellSortingStage } from './stage4';
import { tabbingStringingStage } from './stage5';
import { roboticLayupStage } from './stage6';
import { autoBussingStage } from './stage7';
import { autoTapingNLayupStage } from './stage8';
import { rearEncapsulantStage } from './stage9';
import { backSheetStage } from './stage10';
import { rearGlassLoadingStage } from './stage11';
import { preLamELVisualStage } from './stage12';
import { preLamRepairNAutoEdgeSealStage } from './stage13';
import { laminationStage } from './stage14';
import { autoTrimmingStage } from './stage15';
import { laminateInspectionStage } from './stage16';
import { autoFramingStage } from './stage17';
import { junctionBoxFixingStage } from './stage18';
import { autoJBSolderingStage } from './stage19';
import { autoPottingStage } from './stage20';
import { curingStage } from './stage21';
import { autoFilingStage } from './stage22';
import { cleaningStage } from './stage23';
import { sunSimulatorStage } from './stage24';
import { rfidStage } from './stage25';
import { safetyTestStage } from './stage26';
import { finalELStage } from './stage27';
import { backLabelFixingStage } from './stage28';
import { FQCStage } from './stage29';
import { autoSorterStage } from './stage30';
import { packingStage } from './stage31';

export const initialStages: StageData[] = [
    preLamStage,
    autoFrontGlassStage,
    frontEncapsulantStage,
    cellSortingStage,
    tabbingStringingStage,
    roboticLayupStage,
    autoBussingStage,
    autoTapingNLayupStage,
    rearEncapsulantStage,
    backSheetStage,
    rearGlassLoadingStage,
    preLamELVisualStage,
    preLamRepairNAutoEdgeSealStage,
    laminationStage,
    autoTrimmingStage,
    laminateInspectionStage,
    autoFramingStage,
    junctionBoxFixingStage,
    autoJBSolderingStage,
    autoPottingStage,
    curingStage,
    autoFilingStage,
    cleaningStage,
    sunSimulatorStage,
    rfidStage,
    safetyTestStage,
    finalELStage,
    backLabelFixingStage,
    FQCStage,
    autoSorterStage,
    packingStage
];