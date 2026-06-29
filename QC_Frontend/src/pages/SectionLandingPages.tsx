import SectionLandingPage from '../components/SectionLandingPage';
import { getSectionNavigation, type SectionId } from '../navigation/sectionNavigation';

function NavigationLandingPage({ sectionId }: { sectionId: SectionId }) {
    const section = getSectionNavigation(sectionId);

    return (
        <SectionLandingPage
            title={section.label}
            description={section.description}
            items={section.children}
            emptyStateTitle={section.emptyStateTitle}
            emptyStateDescription={section.emptyStateDescription}
        />
    );
}

export function TaskManagementLandingPage() {
    return <NavigationLandingPage sectionId="task-management" />;
}

export function IPQCLandingPage() {
    return <NavigationLandingPage sectionId="ipqc" />;
}

export function QualityAnalysisLandingPage() {
    return <NavigationLandingPage sectionId="quality-analysis" />;
}
