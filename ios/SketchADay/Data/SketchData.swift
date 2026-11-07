import Foundation

// Placeholder data until the backend exists.
// Ported from mobile/src/data/{prompts,reactions,history}.ts.

// MARK: - Prompts

/// Everyone gets the same prompt on the same day.
struct Prompt: Hashable {
    let text: String
    /// Stand-in picture used until a real sketch image exists.
    let emoji: String
}

enum Prompts {
    static let all: [Prompt] = [
        Prompt(text: "A coffee mug", emoji: "☕"),
        Prompt(text: "Your left hand", emoji: "✋"),
        Prompt(text: "A tree in the wind", emoji: "🌳"),
        Prompt(text: "Your favorite shoe", emoji: "👟"),
        Prompt(text: "A cat napping", emoji: "🐈"),
        Prompt(text: "The view from your window", emoji: "🪟"),
        Prompt(text: "A houseplant", emoji: "🪴"),
        Prompt(text: "Something on your desk", emoji: "🖇️"),
        Prompt(text: "A cloud that looks like an animal", emoji: "☁️"),
        Prompt(text: "Your breakfast", emoji: "🥐"),
        Prompt(text: "A pair of glasses", emoji: "👓"),
        Prompt(text: "A bicycle", emoji: "🚲"),
        Prompt(text: "A rainy street", emoji: "🌧️"),
        Prompt(text: "Your keys", emoji: "🔑"),
    ]

    /// Days since 1970-01-01 in the user's local time zone.
    private static func localDayNumber(_ date: Date) -> Int {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let midnightUTC = utc.date(from: c)!
        return Int((midnightUTC.timeIntervalSince1970 / 86_400).rounded())
    }

    static func forDate(_ date: Date = .now) -> Prompt {
        all[localDayNumber(date) % all.count]
    }
}

// MARK: - Reactions

/// The only reactions people can leave on a sketch: positive emojis, no text comments.
enum Reactions {
    static let all = ["❤️", "🔥", "👏", "😍", "✨", "🎨"]
}

// MARK: - History

enum DayStatus {
    /// Sketch submitted.
    case done
    /// Missed, but a streak freeze kept the streak alive.
    case frozen
    /// Missed, no freeze.
    case missed
    /// Today, not submitted yet.
    case today
    /// Not unlocked yet.
    case locked
}

struct Day: Identifiable, Hashable {
    let date: Date
    let prompt: Prompt
    let status: DayStatus
    /// Uploaded sketch, once the backend exists. Falls back to the prompt emoji.
    var imageURL: URL? = nil
    /// Smudge's feedback on the sketch.
    var feedback: String? = nil

    var id: String { History.key(date) }
}

enum History {
    // Oldest first. Index 0 is 10 days ago.
    private static let mockPast: [(DayStatus, String?)] = [
        (.done, "Love how loose and confident these lines are. Great start!"),
        (.done, "That shading on the left side gives it real weight. Nice!"),
        (.missed, nil),
        (.done, "Bold composition! Try a lighter first pass next time — it’ll pop."),
        (.done, "You nailed the proportions. Smudge is impressed."),
        (.frozen, nil),
        (.done, "Such a fun angle! Most people draw this straight on."),
        (.done, "Your lines are getting steadier every day. Keep going!"),
        (.done, "The little details here make it feel alive. Lovely."),
        (.done, "Wow, look at that texture. Your best one yet!"),
    ]

    private static let lockedDays = 3

    private static func addDays(_ date: Date, _ days: Int) -> Date {
        let cal = Calendar.current
        return cal.date(byAdding: .day, value: days, to: cal.startOfDay(for: date))!
    }

    /// Past days, today, then a few locked future days, oldest first.
    static func get(today: Date = .now) -> [Day] {
        let past = mockPast.enumerated().map { i, entry in
            let date = addDays(today, i - mockPast.count)
            return Day(date: date, prompt: Prompts.forDate(date), status: entry.0, feedback: entry.1)
        }
        let todayDay = Day(date: addDays(today, 0), prompt: Prompts.forDate(today), status: .today)
        let future = (0..<lockedDays).map { i in
            let date = addDays(today, i + 1)
            return Day(date: date, prompt: Prompts.forDate(date), status: .locked)
        }
        return past + [todayDay] + future
    }

    /// Consecutive days kept (done or frozen), counting back from yesterday.
    static func streak(_ history: [Day]) -> Int {
        guard let todayIndex = history.firstIndex(where: { $0.status == .today }) else { return 0 }
        var streak = 0
        for day in history[..<todayIndex].reversed() {
            guard day.status == .done || day.status == .frozen else { break }
            streak += 1
        }
        return streak
    }

    static func key(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// "Nov 7".
    static func shortDate(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.month, .day], from: date)
        return "\(months[c.month! - 1]) \(c.day!)"
    }

    /// "Sat, Nov 7".
    static func weekdayDate(_ date: Date) -> String {
        let weekday = Calendar.current.component(.weekday, from: date)
        return "\(weekdays[weekday - 1]), \(shortDate(date))"
    }
}
