import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BriefcaseBusiness,
  Bot,
  Code2,
  Cog,
  Compass,
  Cpu,
  Factory,
  type LucideIcon,
  Zap,
} from "lucide-react";

type ScheduleCard = {
  day: number;
  row: number;
  span: 1 | 2;
  tone: "coral" | "mustard" | "petrol" | "wine" | "lavender";
  icon: LucideIcon;
  delay: number;
  floating?: boolean;
};

const DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

const CARDS: ScheduleCard[] = [
  { day: 0, row: 4, span: 1, tone: "lavender", icon: Bot, delay: 120 },
  { day: 0, row: 7, span: 1, tone: "petrol", icon: Code2, delay: 360, floating: true },
  { day: 1, row: 2, span: 2, tone: "coral", icon: Cog, delay: 220 },
  { day: 2, row: 2, span: 1, tone: "mustard", icon: Zap, delay: 300 },
  { day: 2, row: 5, span: 1, tone: "wine", icon: Factory, delay: 540, floating: true },
  { day: 3, row: 2, span: 1, tone: "petrol", icon: Code2, delay: 420 },
  { day: 3, row: 8, span: 1, tone: "mustard", icon: BriefcaseBusiness, delay: 660 },
  { day: 4, row: 5, span: 1, tone: "coral", icon: Cpu, delay: 780 },
  { day: 4, row: 8, span: 1, tone: "lavender", icon: Compass, delay: 900 },
];

export default function AnimatedScheduleIllustration() {
  const illustrationRef = useRef<HTMLDivElement>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const illustration = illustrationRef.current;
    if (!illustration) return;

    if (!("IntersectionObserver" in window)) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasEntered(true);
        observer.disconnect();
      },
      { threshold: 0.22 },
    );

    observer.observe(illustration);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={illustrationRef}
      className={`schedule-illustration${hasEntered ? " is-visible" : ""}`}
      aria-hidden="true"
    >
      <div className="schedule-illustration-header">
        <span className="schedule-illustration-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="schedule-illustration-title">HORARIO SEMANAL</span>
        <span className="schedule-illustration-mark">01</span>
      </div>

      <div className="schedule-illustration-weekdays">
        <span />
        {DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="schedule-illustration-table">
        <div className="schedule-illustration-time-column">
          {HOURS.map((hour, index) => (
            <span key={hour} style={{ "--time-index": index } as CSSProperties}>
              {hour}
            </span>
          ))}
        </div>

        {DAYS.map((day, dayIndex) => (
          <div className="schedule-illustration-day-column" key={day}>
            {Array.from({ length: 8 }, (_, index) => (
              <i
                className="schedule-illustration-slot-line"
                key={`slot-${day}-${index}`}
                style={{ "--slot-index": index } as CSSProperties}
              />
            ))}
            {CARDS.filter((card) => card.day === dayIndex).map((card) => {
              const Icon = card.icon;
              const style = {
                "--card-delay": `${card.delay}ms`,
                gridRow: `${card.row} / span ${card.span}`,
              } as CSSProperties;

              return (
                <span
                  className={`schedule-illustration-card schedule-illustration-card-${card.tone}${card.floating ? " schedule-illustration-card-floating" : ""}`}
                  key={`${card.day}-${card.row}`}
                  style={style}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  <i />
                  <i />
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <span className="schedule-illustration-shadow" />
    </div>
  );
}
