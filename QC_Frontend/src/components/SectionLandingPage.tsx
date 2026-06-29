import { ArrowUpRight, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NavigationChildItem } from '../navigation/sectionNavigation';

interface SectionLandingPageProps {
    title: string;
    description: string;
    items: NavigationChildItem[];
    emptyStateTitle?: string;
    emptyStateDescription?: string;
}

export default function SectionLandingPage({
    title,
    description,
    items,
    emptyStateTitle = 'No pages configured',
    emptyStateDescription = 'There are no links available for this section yet.',
}: SectionLandingPageProps) {
    return (
        <div className="min-h-[calc(100vh-6rem)] rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-sm transition-colors duration-300 dark:border-slate-700/70 dark:bg-slate-950 dark:text-white">
            <header className="mb-4 border-b border-slate-200 pb-2 dark:border-slate-800">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    {title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {description}
                </p>
            </header>
            {items.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {items.map((item) => {
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className="group flex min-h-36 flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4 shadow-sm outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-primary/35 hover:bg-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-primary/50 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-brand-primary/45 dark:hover:bg-slate-900"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary transition-colors duration-300 group-hover:bg-brand-primary group-hover:text-white dark:bg-brand-primary/15 dark:text-brand-primary-light">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold leading-5 text-slate-950 dark:text-white">
                                            {item.label}
                                        </h2>
                                        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-end text-xs font-semibold text-brand-primary dark:text-brand-primary-light">
                                    Open
                                    <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/15 dark:text-brand-primary-light">
                        <FolderOpen className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{emptyStateTitle}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {emptyStateDescription}
                    </p>
                </div>
            )}
        </div>
    );
}
