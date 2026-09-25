/**
 * English catalogue. The type ties it to the Polish key set, so a missing or
 * stray key is a compile error as well as a test failure.
 *
 * Wording note: the machine is a "parcel locker"; no operator brand names.
 */
import type { MessageKey } from './pl.js';

export const en: Record<MessageKey, string> = {
  'app.tagline': 'You are the parcel locker’s memory.',

  'title.play': 'Today',
  'title.howto': 'How to play',
  'title.streak': 'Streak: {count}',
  'title.best': 'Best: {score}',
  'title.noStreak': 'No game today yet',
  'title.noStorage': 'This browser will not remember your streak',

  'howto.title': 'How to play',
  'howto.step1': 'Load: tap a box the parcel fits into.',
  'howto.step2': 'Serve: remember what went where and open the right door.',
  'howto.step3': 'Sweep: clear the marked boxes and close the day.',
  'howto.hintNote': 'After a mistake or a pause we reveal the colour, then the column.',
  'howto.back': 'Back',

  'hud.phase.load': 'Loading',
  'hud.phase.serve': 'Serving',
  'hud.phase.sweep': 'Sweeping',
  'hud.parcelsLeft': 'Parcels: {count}',
  'hud.queue': 'Queue: {count}',
  'hud.sound': 'Sound',

  'a11y.wall': 'Locker wall',
  'door.label': 'Box {id}, size {size}, {state}',
  'door.state.empty': 'empty',
  'door.state.full': 'occupied',
  'door.state.open': 'open',
  'door.state.outgoing': 'holds an outgoing parcel',
  'door.state.expired': 'holds an uncollected parcel',
  'door.state.marked': 'to be cleared',

  'screen.pickup': 'Pickup',
  'screen.sender': 'Drop-off',
  'screen.senderNeeds': 'Needs a box: {size}',
  'screen.nextUp': 'Next up',
  'screen.loadPrompt': 'Put the parcel in a box',
  'screen.sweepPrompt': 'Clear the marked boxes',
  'screen.sweepRemaining': 'Left: {count}',
  'screen.idle': 'Nobody here. For now.',
  'screen.thisParcel': 'This parcel',

  'hint.colour': 'the {colour} one',
  'hint.colourSticker': 'the {colour} one {sticker}',
  'hint.sticker.fragile': 'with the fragile sticker',
  'hint.sticker.arrow': 'with the arrow sticker',
  'hint.sticker.bang': 'with the exclamation mark',

  'colour.red': 'red',
  'colour.orange': 'orange',
  'colour.yellow': 'yellow',
  'colour.green': 'green',
  'colour.blue': 'blue',
  'colour.violet': 'violet',

  'sticker.none': 'no sticker',
  'sticker.fragile': 'fragile',
  'sticker.arrow': 'arrow',
  'sticker.bang': 'exclamation mark',

  'size.A': 'small',
  'size.B': 'medium',
  'size.C': 'large',

  'result.time': 'Time',
  'result.streak': 'Streak',
  'result.best': 'Best',
  'result.official': 'Today’s result',
  'result.practice': 'Practice — today’s result stands',
  'result.playAgain': 'Play again',
  'result.served': 'Served: {count}',
  'result.hinted': 'With a hint: {count}',
  'result.walked': 'Walked away: {count}',
  'result.refused': 'No box free: {count}',
  'result.unplaced': 'Left on the van: {count}',
  'result.wrongTaps': 'Mistakes: {count}',
  'result.home': 'Home',

  'share.button': 'Share',
  'share.mode.daily': 'Today',
  'share.points': 'pts',
  'share.shared': 'Shared',
  'share.copied': 'Copied to the clipboard',
  'share.manual': 'Copy the text below',

  'title.week': 'Week',
  'title.weekBest': 'Best week: {score}',
  'title.continueWeek': 'Continue week · {day}',

  'day.mon': 'Mon',
  'day.tue': 'Tue',
  'day.wed': 'Wed',
  'day.thu': 'Thu',
  'day.fri': 'Fri',
  'day.sat': 'Sat',
  'day.full.mon': 'Monday',
  'day.full.tue': 'Tuesday',
  'day.full.wed': 'Wednesday',
  'day.full.thu': 'Thursday',
  'day.full.fri': 'Friday',
  'day.full.sat': 'Saturday',

  'hud.lateVan': 'The van is late',
  'hud.stars': 'Stars: {count} of {total}',

  'screen.forgottenCode': 'Cannot remember the code',
  'screen.describes': '{size} · {look}',
  'screen.jammed': 'Jammed door',

  'week.dayDone': 'End of day',
  'week.nextDay': 'Next day',
  'week.title': 'Sunday',
  'week.total': 'Total',
  'week.best': 'Best week',
  'week.newBest': 'New best week',
  'week.retry': 'Retry this week',
  'week.new': 'New week',
  'week.starsLost': 'Stars lost: {count}',
  'week.noStarsLost': 'Nothing lost',
  'week.share.mode': 'Week',
  'week.incidents': 'What cost the stars',
  'week.incident.unplaced': 'Parcels left on the van: {count}',
  'week.incident.refused': 'Drop-offs with no box: {count}',
  'week.incident.walked': 'Pickups that walked: {count}',

  'fail.title': 'Complaint filed',
  'fail.lead': 'The stars are gone. The week is over.',
  'fail.dayReached': 'Ended on: {day}',

  'howto.step4': 'From Thursday something breaks: doors jam, codes get forgotten, rain smudges a digit.',
  'howto.step5': 'A Week gives you three stars. Every parcel left on the van, every refusal and every walk-out costs one.',

  'lang.pl': 'Polski',
  'lang.en': 'English',
  'lang.switchTo': 'Switch to {lang}',
};
