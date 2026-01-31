type SegmentTab<T extends string> = {
  id: T
  label: string
}

type SegmentTabsProps<T extends string> = {
  tabs: SegmentTab<T>[]
  activeId: T
  onChange: (id: T) => void
}

const SegmentTabs = <T extends string>({
  tabs,
  activeId,
  onChange,
}: SegmentTabsProps<T>) => {
  return (
    <div className="segment-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`segment-tab ${activeId === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default SegmentTabs
