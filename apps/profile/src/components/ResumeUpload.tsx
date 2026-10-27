import type { Profile } from '@jobsearch/data';
import {
  getErrorMessage,
  useResumeMatcherStatus,
  useSyncResumeToMatcher,
  useUploadResume,
} from '@jobsearch/data';
import { useId, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Props {
  fileName: string | null;
  onUploaded: (profile: Profile) => void;
}

/** Picks a PDF or Word file and sends it straight away; the API turns it into text. */
export function ResumeUpload({ fileName, onUploaded }: Props) {
  const upload = useUploadResume();
  const matcher = useResumeMatcherStatus();
  const syncToMatcher = useSyncResumeToMatcher();
  const inputId = useId();
  const [tooBig, setTooBig] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-500"
        >
          {upload.isPending ? 'Reading your resume…' : 'Upload a PDF or Word file'}
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            disabled={upload.isPending}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear it so picking the same file again still fires onChange.
              e.target.value = '';
              if (!file) return;
              upload.reset();
              // The API refuses bigger files too; checking here saves sending them.
              setTooBig(file.size > MAX_BYTES);
              if (file.size > MAX_BYTES) return;
              upload.mutate(file, {
                onSuccess: (profile) => {
                  onUploaded(profile);
                  // Jobs are matched against Resume-Matcher's copy, so send the new file along.
                  if (matcher.data?.reachable) syncToMatcher.mutate();
                },
              });
            }}
          />
        </label>
        <span className="text-xs text-slate-500">
          {fileName ? `Last upload: ${fileName}` : 'Up to 5 MB. Scanned images can’t be read.'}
        </span>
      </div>
      {upload.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          Resume read. The text below is what we’ll use; fix anything that came out wrong.
        </p>
      )}
      {(tooBig || upload.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {tooBig ? 'That file is over 5 MB.' : getErrorMessage(upload.error)}
        </p>
      )}
    </div>
  );
}
