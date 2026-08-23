/**
 * English catalogue. The type ties it to the Polish key set, so a missing or
 * stray key is a compile error as well as a test failure.
 *
 * Wording note: the machine is a "parcel locker"; no operator brand names.
 */
import type { MessageKey } from './pl.js';

export const en: Record<MessageKey, string> = {
  'app.title': 'paczkom.at',
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
  'hud.score': 'Score',
  'hud.time': 'Time',
  'hud.parcelsLeft': 'Parcels: {count}',
  'hud.queue': 'Queue: {count}',
  'hud.mute': 'Mute',
  'hud.unmute': 'Unmute',
  'hud.language': 'Language',

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
  'screen.code': 'Code',
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

  'result.title': 'Day closed',
  'result.daily': 'Today #{number}',
  'result.score': 'Score',
  'result.time': 'Time',
  'result.streak': 'Streak',
  'result.best': 'Best',
  'result.official': 'Today’s result',
  'result.practice': 'Practice — today’s result stands',
  'result.practiceScore': 'Practice: {score}',
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
  'share.failed': 'Sharing did not work',

  'lang.pl': 'Polski',
  'lang.en': 'English',
  'lang.toggle': 'PL / EN',
};
