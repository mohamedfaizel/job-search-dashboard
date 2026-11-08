import type { BuilderSection } from '@jobsearch/data';
import { useImproveSection, useImproveSectionPrompt } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { ImproveFlow } from './ImproveFlow';

interface Props {
  section: BuilderSection;
  /** The job whose copy this is; null for your master resume. */
  jobId: string | null;
  language: string;
  /** Keep: the improved section goes into the resume (one undo step). */
  onKeep: (section: BuilderSection) => void;
  onClose: () => void;
}

/** Improve one section with AI: the shared flow, asked about this section. */
export function ImprovePanel({ section, jobId, language, onKeep, onClose }: Props) {
  const t = useTranslations('Resume.improve');
  const promptFor = useImproveSectionPrompt();
  const improve = useImproveSection();
  const input = (instruction: string) => ({
    sectionId: section.id,
    jobId,
    language,
    instruction: instruction || null,
  });
  return (
    <ImproveFlow<BuilderSection>
      title={t('title')}
      hint={t('hint')}
      getPrompt={(instruction) => promptFor.mutateAsync(input(instruction))}
      run={async (instruction, reply) => {
        const out = await improve.mutateAsync({ ...input(instruction), reply });
        return {
          before: out.before,
          after: out.after,
          findings: out.findings,
          value: JSON.parse(out.section) as BuilderSection,
        };
      }}
      onKeep={onKeep}
      onClose={onClose}
    />
  );
}
