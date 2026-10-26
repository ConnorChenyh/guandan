# Rules and Difficulty

**English** | [简体中文](rules.zh-CN.md)

## Teams and cards

Four players, two 54-card decks, 27 cards each. You and Xiaobei (opposite you) are one team; Alan on your right and Lao Zhou on your left are the other. Play goes clockwise. The first round starts with a random player at level 2; after that, each round is played at the level of the team that won the previous round.

Single-card order: big joker, small joker, the current level card, then A down to 2 (skipping the level rank). The heart level card is wild: it can stand in for any ordinary rank and suit, but not for a joker. Played on its own, it counts as a level card.

## Patterns

Single, pair, triple, three-with-pair (三带二), five-card straight, three consecutive pairs, two consecutive triples (steel plate), bombs of four or more cards of one rank, five-card straight flush, and the four-joker bomb. Straights and other runs may be A-2-3… or …Q-K-A but may not wrap around A. Inside runs, the level card keeps its natural rank.

Order: four-joker bomb > bombs of six or more cards > straight flush > five-card bomb > four-card bomb > ordinary patterns. Between bombs, more cards wins; with equal size, higher rank wins. An ordinary play can only be beaten by the same pattern with the same number of cards. For three-with-pair, only the triple is compared.

When wild cards allow several readings of the selected cards, following a play uses the lowest category that beats it. Leading prefers a straight flush (including one made with a wild), and otherwise also uses the lowest category. Within one pattern, when a wild could go at either end (for example 2-6 or 3-7), the larger reading is the default. The selection area shows the reading that will be played. The AI uses the same rule engine.

## Play area

Each seat shows its latest play. When a player passes, their area clears immediately and shows “不出” (pass); other seats are unaffected. Playing again replaces the pass marker, and refreshing keeps the same state. A finished player's last cards disappear once someone beats them, or once the trick ends with nobody able to beat them. Only the avatar of the player whose turn it is gets highlighted (a gold ring); the play areas themselves are never highlighted.

## Winning the lead and scoring

When every remaining player after the last play passes, that player leads again. If they have already gone out, their partner (if still playing) takes the lead; if the partner is out too, the next active player leads.

The team of the first player out wins the round. Partner finishing second: up 3 levels; third: up 2; last: up 1. A double win (first and second) ends the round immediately; the two losing players still holding cards are listed by seat on the results screen, and their order does not affect level-ups, tribute refusal or how tribute cards are assigned.

At level A, a team passes A by finishing first with the partner not last. A failed A round keeps the team at A; after three failures it drops back to 2. A team reaching A must play and win one more round at its own A to win the match.

## Tribute

No tribute in the first round. Single loss: the last player gives their highest card (other than the heart level card) to the first player. Double loss: both losers each give their highest such card; the higher goes to the first player, the other to the second. Ties are resolved by seat number. Whoever gave the highest tribute card leads; on a tie, the first by that seat order leads.

If the single tribute giver holds both big jokers, or the two double-tribute givers hold both big jokers between them, tribute is refused and the first player leads.

Each player who received tribute returns one non-level card of 10 or lower; if they have none, they return their lowest card other than the heart level card. You pick from highlighted legal cards; the computer picks automatically. After returns, everyone is back to 27 cards.

## AI difficulty

- **Easy**: picks at random among legal moves, prefers ordinary plays, rarely bombs, and sometimes lets its partner keep the lead.
- **Normal**: first splits the hand into the fewest playable groups (straights, consecutive pairs, steel plates, three-with-pair, bombs, straight flushes…), then picks each move by “quality of the remaining hand + value of winning this trick”. It takes control with its smallest unbeatable card, keeps control cards for answering and only cashes them first in the final run, saves bombs until an opponent is close to going out, stays out of its partner's way, and feeds a partner who is about to go out. Normal does not count played cards, so it judges control cards conservatively.
- **Hard**: normal, plus counting played cards and inferring from opponents' passes which shapes they lack. In the endgame it deals the unseen cards to the other three players many plausible ways (matching their card counts), plays each candidate move out to the end of the round, and picks the move with the best average result (about 0.7 seconds).

The AI only receives its own hand, every player's card count, the public plays and passes of the current round, the level and the difficulty. It never sees another player's hidden cards; the endgame search only samples possible hands. If the Web Worker takes longer than 2.5 seconds or fails, the game falls back to the normal strategy. Changing difficulty mid-game cancels the current calculation and decides again at the new level.

Developers can run `node tests/bench.mjs 200 normal old-normal` for a self-play benchmark (each deal is played twice with seats swapped).
