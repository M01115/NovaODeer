import SwiftUI

private let weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
private let cardMuted = Color(hex: 0x33322F)
private let ice = Color(hex: 0xBFE3F5)

/// Shown once when the app opens: the current streak and this week at a glance.
/// The flexible spacers are the gaps between elements on an 852pt-tall iPhone screen,
/// so the screen scales evenly. Ported from mobile/src/app/streak.tsx.
struct StreakView: View {
    /// "See past sketches": close this screen and open the archive.
    var onSeePast: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    private let history = History.get()

    /// This week, Sunday to Saturday.
    private var week: [(label: String, status: DayStatus)] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let todayWeekday = cal.component(.weekday, from: today) - 1 // 0 = Sunday
        let byKey = Dictionary(history.map { ($0.id, $0.status) }, uniquingKeysWith: { a, _ in a })
        return weekdays.enumerated().map { i, label in
            let date = cal.date(byAdding: .day, value: i - todayWeekday, to: today)!
            let status = byKey[History.key(date)] ?? (i < todayWeekday ? .missed : .locked)
            return (label, status)
        }
    }

    var body: some View {
        let streak = History.streak(history)

        GeometryReader { geo in
            let unit = geo.size.height / 852

            VStack(spacing: 0) {
                Spacer().frame(height: 102 * unit)

                Smudge(size: 154)
                    .overlay(alignment: .topTrailing) {
                        Text("🔥")
                            .font(.system(size: 46))
                            .rotationEffect(.degrees(12))
                            .offset(x: 18, y: 4)
                    }

                Spacer().frame(height: 7 * unit)

                Text("\(streak)")
                    .font(.system(size: 116, weight: .black))
                    .foregroundStyle(Ink.ink)
                Text(streak == 0 ? "start your streak!" : "day streak!")
                    .font(.system(size: 27, weight: .heavy))
                    .foregroundStyle(Ink.ink)

                Spacer().frame(height: 33 * unit)

                HStack {
                    ForEach(week, id: \.label) { day in
                        VStack(spacing: 10) {
                            Text(day.label)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(day.status == .today ? Ink.red : Palette.textSecondary)
                            DayDot(status: day.status)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 93)
                .background(Ink.ink, in: RoundedRectangle(cornerRadius: 18))

                Spacer(minLength: 0)

                // Home is today's prompt, so starting the sketch just closes this screen.
                Button { dismiss() } label: {
                    Text("✏️  START TODAY’S SKETCH")
                        .font(.system(size: 15, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(.white)
                        .frame(height: 43)
                }
                .buttonStyle(LipButtonStyle())

                Spacer().frame(height: 20 * unit)

                Button(action: onSeePast) {
                    Text("SEE PAST SKETCHES")
                        .font(.system(size: 16, weight: .heavy))
                        .tracking(1.5)
                        .foregroundStyle(Ink.ink)
                }
                .buttonStyle(PressedOpacity())

                Spacer().frame(height: 22 * unit)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
    }
}

private struct DayDot: View {
    let status: DayStatus

    var body: some View {
        switch status {
        case .done, .frozen:
            Circle()
                .fill(status == .done ? .white : ice)
                .frame(width: 27, height: 27)
                .overlay {
                    Text(status == .frozen ? "❄" : "✓")
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(Ink.ink)
                }
        case .today:
            Circle()
                .strokeBorder(Ink.red, style: StrokeStyle(lineWidth: 2.5, dash: [4, 3]))
                .frame(width: 27, height: 27)
        case .missed, .locked:
            Circle().fill(cardMuted).frame(width: 27, height: 27)
        }
    }
}

#Preview {
    StreakView()
}
