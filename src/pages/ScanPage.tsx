import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckIcon, CircleAlertIcon, FileUpIcon } from 'lucide-react'
import {
  draftFromExtraction,
  requestExtraction,
  storePendingDraft,
  ExtractionError,
} from '@/lib/extraction'
import { extractPdfText, formatFileSize, PdfTextError } from '@/lib/pdf'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'reading' | 'extracting' | 'building' | 'error'

interface ScanState {
  phase: Phase
  fileName?: string
  fileSize?: number
  pageCount?: number
  /** Extracted PDF text, kept across failures so Retry skips re-upload. */
  keptText?: string
  error?: string
}

const STEPS = [
  { title: 'Reading PDF', pending: 'Extract text in the browser' },
  { title: 'Extracting with AI', pending: 'DeepSeek identifies fields and line items' },
  { title: 'Building draft', pending: 'Review before saving' },
] as const

function stepIndex(phase: Phase): number {
  if (phase === 'reading') return 0
  if (phase === 'extracting') return 1
  return 2
}

function Stepper({ current, doneText }: { current: number; doneText: string[] }) {
  return (
    <ol className="flex flex-col">
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo'
        return (
          <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-3 top-7 h-[calc(100%-1.75rem)] w-0.5',
                  state === 'done' ? 'bg-brand' : 'bg-line',
                )}
              />
            )}
            <span
              className={cn(
                'z-10 grid size-6 flex-none place-items-center rounded-full text-xs',
                state === 'done' && 'bg-brand text-white',
                state === 'now' &&
                  'animate-pulse border-2 border-brand bg-card text-brand motion-reduce:animate-none',
                state === 'todo' && 'border-2 border-line bg-paper text-ink-3',
              )}
            >
              {state === 'done' ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            <div>
              <div
                className={cn(
                  'text-[13.5px] font-semibold',
                  state === 'todo' && 'font-medium text-ink-3',
                )}
              >
                {step.title}
              </div>
              <div className="text-xs text-ink-2">
                {state === 'done' ? doneText[i] : step.pending}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function FileChip({ name, size, pages }: { name: string; size: number; pages?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b pb-4">
      <div className="grid size-9 flex-none place-items-center rounded-md bg-st-cancel-tint text-[9px] font-bold text-st-cancel">
        PDF
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold">{name}</div>
        <div className="text-xs text-ink-3">
          {formatFileSize(size)}
          {pages != null && ` · ${pages} ${pages === 1 ? 'page' : 'pages'}`}
        </div>
      </div>
    </div>
  )
}

export function ScanPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<ScanState>({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runExtraction = async (text: string, base: Omit<ScanState, 'phase'>) => {
    setState({ ...base, phase: 'extracting', keptText: text })
    try {
      const extracted = await requestExtraction(text)
      setState({ ...base, phase: 'building', keptText: text })
      storePendingDraft(draftFromExtraction(extracted))
      navigate('/invoices/draft')
    } catch (err) {
      setState({
        ...base,
        phase: 'error',
        keptText: text,
        error:
          err instanceof ExtractionError
            ? err.message
            : 'Something unexpected went wrong during extraction.',
      })
    }
  }

  const handleFile = async (file: File) => {
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      toast.error('Only PDF files are supported.')
      return
    }
    const base = { fileName: file.name, fileSize: file.size }
    setState({ ...base, phase: 'reading' })
    try {
      const { text, pageCount } = await extractPdfText(file)
      await runExtraction(text, { ...base, pageCount })
    } catch (err) {
      setState({
        ...base,
        phase: 'error',
        error:
          err instanceof PdfTextError
            ? err.message
            : "This file couldn't be read as a PDF.",
      })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const busy = state.phase === 'reading' || state.phase === 'extracting' || state.phase === 'building'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-semibold tracking-tight">Scan invoice</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Upload a text-based PDF — the AI extracts a draft invoice you can review and edit.
        </p>
      </div>

      <div className="mx-auto max-w-[640px]">
        {state.phase === 'idle' && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a PDF invoice"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-strong bg-card px-8 py-14 text-center transition-colors hover:border-brand hover:bg-brand-tint',
              dragging && 'border-brand bg-brand-tint',
            )}
          >
            <div className="mb-1.5 grid size-[52px] place-items-center rounded-xl bg-brand-tint text-brand">
              <FileUpIcon className="size-6" aria-hidden="true" />
            </div>
            <div className="text-base font-semibold">Drop your PDF invoice here</div>
            <p className="text-[13px] text-ink-2">Any layout or language · one invoice per file</p>
            <div className="label-caps my-1">or</div>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
            >
              Browse files
            </Button>
            <p className="mt-2 text-[11.5px] text-ink-3">
              PDF only · text-based (scanned images not supported)
            </p>
          </div>
        )}

        {(busy || state.phase === 'error') && (
          <div className="rounded-xl border bg-card p-5">
            {state.fileName != null && state.fileSize != null && (
              <FileChip name={state.fileName} size={state.fileSize} pages={state.pageCount} />
            )}
            {busy ? (
              <Stepper
                current={stepIndex(state.phase)}
                doneText={[
                  `Text extracted from ${state.pageCount ?? '…'} ${state.pageCount === 1 ? 'page' : 'pages'}`,
                  'Fields and line items identified',
                  '',
                ]}
              />
            ) : (
              <>
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-st-cancel/25 bg-st-cancel-tint px-3.5 py-3 text-[12.5px] text-st-cancel"
                >
                  <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                  <div>
                    <div className="text-[13px] font-bold">Extraction failed</div>
                    <p className="mt-0.5">{state.error}</p>
                    {state.keptText && (
                      <p className="mt-1 text-st-cancel/80">
                        Your PDF text is kept — retry without re-uploading.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  {state.keptText && (
                    <Button
                      onClick={() =>
                        void runExtraction(state.keptText!, {
                          fileName: state.fileName,
                          fileSize: state.fileSize,
                          pageCount: state.pageCount,
                        })
                      }
                    >
                      Retry extraction
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setState({ phase: 'idle' })}>
                    Choose another file
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </div>
    </div>
  )
}
