// Колода Таро: 78 карт, канон Райдер-Уэйт-Смит (марсельский порядок НЕ используется — это Таро, не Матрица).
// Визуал: client/public/tarot/<id>.webp (генерируется отдельно), фолбэк — рубашка.
export type TarotSuit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

export interface TarotCard {
  id: string;
  suit: TarotSuit;
  /** 0–21 для старших, 1–14 для младших (11=паж, 12=рыцарь, 13=королева, 14=король) */
  num: number;
  nameRu: string;
  nameEn: string;
  /** Ключевые слова: [прямое ru, перевёрнутое ru, upright en, reversed en] */
  kw: [string, string, string, string];
}

export const TAROT_DECK: readonly TarotCard[] = [
  { id: 'fool', suit: 'major', num: 0, nameRu: 'Шут', nameEn: 'The Fool', kw: ['начало, свобода, вера, спонтанность', 'безрассудство, наивность, страх шага', 'beginnings, freedom, faith, spontaneity', 'recklessness, naivety, fear of the leap'] },
  { id: 'magician', suit: 'major', num: 1, nameRu: 'Маг', nameEn: 'The Magician', kw: ['воля, мастерство, манифестация', 'манипуляция, распыление, блеф', 'willpower, skill, manifestation', 'manipulation, scattered energy, illusion'] },
  { id: 'high-priestess', suit: 'major', num: 2, nameRu: 'Верховная Жрица', nameEn: 'The High Priestess', kw: ['интуиция, тайна, внутреннее знание', 'игнорирование интуиции, секреты', 'intuition, mystery, inner knowing', 'ignored intuition, secrets'] },
  { id: 'empress', suit: 'major', num: 3, nameRu: 'Императрица', nameEn: 'The Empress', kw: ['изобилие, забота, творчество', 'зависимость, застой, гиперопека', 'abundance, nurturing, creativity', 'dependence, stagnation, smothering'] },
  { id: 'emperor', suit: 'major', num: 4, nameRu: 'Император', nameEn: 'The Emperor', kw: ['структура, порядок, ответственность', 'жёсткость, контроль, тирания', 'structure, order, responsibility', 'rigidity, control, domination'] },
  { id: 'hierophant', suit: 'major', num: 5, nameRu: 'Иерофант', nameEn: 'The Hierophant', kw: ['традиция, обучение, наставник', 'догматизм, бунт против правил', 'tradition, learning, guidance', 'dogma, rebellion against rules'] },
  { id: 'lovers', suit: 'major', num: 6, nameRu: 'Влюблённые', nameEn: 'The Lovers', kw: ['выбор сердца, союз, гармония', 'разлад, соблазн, трудный выбор', 'choice of the heart, union, harmony', 'discord, temptation, hard choice'] },
  { id: 'chariot', suit: 'major', num: 7, nameRu: 'Колесница', nameEn: 'The Chariot', kw: ['воля к победе, движение, контроль', 'потеря курса, агрессия, буксование', 'willpower, momentum, control', 'lost direction, aggression, stalling'] },
  { id: 'strength', suit: 'major', num: 8, nameRu: 'Сила', nameEn: 'Strength', kw: ['мягкая сила, терпение, смелость', 'сомнение в себе, подавленный гнев', 'gentle strength, patience, courage', 'self-doubt, suppressed anger'] },
  { id: 'hermit', suit: 'major', num: 9, nameRu: 'Отшельник', nameEn: 'The Hermit', kw: ['поиск смысла, уединение, мудрость', 'изоляция, одиночество, отказ от помощи', 'soul-searching, solitude, wisdom', 'isolation, loneliness, refusing help'] },
  { id: 'wheel-of-fortune', suit: 'major', num: 10, nameRu: 'Колесо Фортуны', nameEn: 'Wheel of Fortune', kw: ['поворот судьбы, циклы, шанс', 'сопротивление переменам, полоса неудач', 'turning point, cycles, luck', 'resisting change, a rough patch'] },
  { id: 'justice', suit: 'major', num: 11, nameRu: 'Справедливость', nameEn: 'Justice', kw: ['честность, баланс, последствия', 'несправедливость, самообман, уклонение', 'fairness, balance, consequences', 'injustice, self-deception, avoidance'] },
  { id: 'hanged-man', suit: 'major', num: 12, nameRu: 'Повешенный', nameEn: 'The Hanged Man', kw: ['пауза, новый взгляд, принятие', 'застревание, жертва без смысла', 'pause, new perspective, surrender', 'stuckness, pointless sacrifice'] },
  { id: 'death', suit: 'major', num: 13, nameRu: 'Смерть', nameEn: 'Death', kw: ['трансформация, завершение, обновление', 'страх перемен, цепляние за старое', 'transformation, endings, renewal', 'fear of change, clinging to the old'] },
  { id: 'temperance', suit: 'major', num: 14, nameRu: 'Умеренность', nameEn: 'Temperance', kw: ['баланс, исцеление, терпение', 'крайности, дисбаланс, спешка', 'balance, healing, patience', 'extremes, imbalance, haste'] },
  { id: 'devil', suit: 'major', num: 15, nameRu: 'Дьявол', nameEn: 'The Devil', kw: ['привязанности, зависимость, теневое', 'освобождение, осознание цепей', 'attachments, addiction, shadow', 'liberation, seeing the chains'] },
  { id: 'tower', suit: 'major', num: 16, nameRu: 'Башня', nameEn: 'The Tower', kw: ['внезапное разрушение иллюзий, прорыв', 'затянутый кризис, страх краха', 'sudden upheaval, breakthrough', 'prolonged crisis, fear of collapse'] },
  { id: 'star', suit: 'major', num: 17, nameRu: 'Звезда', nameEn: 'The Star', kw: ['надежда, вдохновение, исцеление', 'разочарование, потеря веры', 'hope, inspiration, healing', 'disappointment, lost faith'] },
  { id: 'moon', suit: 'major', num: 18, nameRu: 'Луна', nameEn: 'The Moon', kw: ['иллюзии, подсознание, тревога', 'прояснение, выход из тумана', 'illusion, subconscious, anxiety', 'clarity, fog lifting'] },
  { id: 'sun', suit: 'major', num: 19, nameRu: 'Солнце', nameEn: 'The Sun', kw: ['радость, успех, ясность', 'временные тучи, завышенные ожидания', 'joy, success, clarity', 'temporary clouds, inflated expectations'] },
  { id: 'judgement', suit: 'major', num: 20, nameRu: 'Суд', nameEn: 'Judgement', kw: ['пробуждение, переоценка, призвание', 'самокритика, игнорирование зова', 'awakening, reckoning, calling', 'self-judgement, ignoring the call'] },
  { id: 'world', suit: 'major', num: 21, nameRu: 'Мир', nameEn: 'The World', kw: ['завершение цикла, целостность, итог', 'незавершённость, последний шаг', 'completion, wholeness, fulfilment', 'loose ends, the final step'] },
  { id: 'ace-of-wands', suit: 'wands', num: 1, nameRu: 'Туз Жезлов', nameEn: 'Ace of Wands', kw: ['новая искра, вдохновение, старт', 'ложный старт, задержка идеи', 'a creative spark, inspiration, a start', 'false start, delayed idea'] },
  { id: 'two-of-wands', suit: 'wands', num: 2, nameRu: 'Двойка Жезлов', nameEn: 'Two of Wands', kw: ['планирование, выбор пути, амбиции', 'страх выйти из зоны комфорта', 'planning, choosing a path, ambition', 'fear of leaving the comfort zone'] },
  { id: 'three-of-wands', suit: 'wands', num: 3, nameRu: 'Тройка Жезлов', nameEn: 'Three of Wands', kw: ['расширение, первые результаты', 'задержки, узкий горизонт', 'expansion, first results', 'delays, narrow horizon'] },
  { id: 'four-of-wands', suit: 'wands', num: 4, nameRu: 'Четвёрка Жезлов', nameEn: 'Four of Wands', kw: ['праздник, дом, стабильная база', 'шаткая опора, отложенная радость', 'celebration, home, a stable base', 'shaky foundation, postponed joy'] },
  { id: 'five-of-wands', suit: 'wands', num: 5, nameRu: 'Пятёрка Жезлов', nameEn: 'Five of Wands', kw: ['конкуренция, спор, тренировка', 'конфликт ради конфликта', 'competition, friction, sparring', 'conflict for its own sake'] },
  { id: 'six-of-wands', suit: 'wands', num: 6, nameRu: 'Шестёрка Жезлов', nameEn: 'Six of Wands', kw: ['победа, признание, успех', 'тщеславие, задержка признания', 'victory, recognition, success', 'vanity, delayed recognition'] },
  { id: 'seven-of-wands', suit: 'wands', num: 7, nameRu: 'Семёрка Жезлов', nameEn: 'Seven of Wands', kw: ['оборона позиции, стойкость', 'истощение, давление со всех сторон', 'defending your ground, resilience', 'exhaustion, pressure from all sides'] },
  { id: 'eight-of-wands', suit: 'wands', num: 8, nameRu: 'Восьмёрка Жезлов', nameEn: 'Eight of Wands', kw: ['скорость, новости, движение', 'суета, разлетающиеся планы', 'speed, news, momentum', 'haste, scattered plans'] },
  { id: 'nine-of-wands', suit: 'wands', num: 9, nameRu: 'Девятка Жезлов', nameEn: 'Nine of Wands', kw: ['последний рубеж, выдержка', 'паранойя, упрямство из усталости', 'the last stretch, endurance', 'paranoia, weary stubbornness'] },
  { id: 'ten-of-wands', suit: 'wands', num: 10, nameRu: 'Десятка Жезлов', nameEn: 'Ten of Wands', kw: ['перегруз, ноша успеха', 'неумение делегировать', 'overload, the weight of success', 'inability to delegate'] },
  { id: 'page-of-wands', suit: 'wands', num: 11, nameRu: 'Паж Жезлов', nameEn: 'Page of Wands', kw: ['энтузиазм ученика, весть о деле', 'незрелые планы, разбросанность', 'a learner\'s enthusiasm, news of a venture', 'immature plans, scattered focus'] },
  { id: 'knight-of-wands', suit: 'wands', num: 12, nameRu: 'Рыцарь Жезлов', nameEn: 'Knight of Wands', kw: ['напор, страсть, приключение', 'импульсивность, выгорание', 'drive, passion, adventure', 'impulsiveness, burnout'] },
  { id: 'queen-of-wands', suit: 'wands', num: 13, nameRu: 'Королева Жезлов', nameEn: 'Queen of Wands', kw: ['харизма, уверенность, тепло', 'ревность, требование внимания', 'charisma, confidence, warmth', 'jealousy, demanding attention'] },
  { id: 'king-of-wands', suit: 'wands', num: 14, nameRu: 'Король Жезлов', nameEn: 'King of Wands', kw: ['лидерство, видение, предприниматель', 'авторитарность, нетерпение', 'leadership, vision, enterprise', 'authoritarianism, impatience'] },
  { id: 'ace-of-cups', suit: 'cups', num: 1, nameRu: 'Туз Кубков', nameEn: 'Ace of Cups', kw: ['новое чувство, открытое сердце', 'подавленные эмоции, пустота', 'a new feeling, an open heart', 'suppressed emotions, emptiness'] },
  { id: 'two-of-cups', suit: 'cups', num: 2, nameRu: 'Двойка Кубков', nameEn: 'Two of Cups', kw: ['взаимность, союз двоих', 'разлад, дисбаланс в паре', 'mutuality, a union of two', 'discord, imbalance in a pair'] },
  { id: 'three-of-cups', suit: 'cups', num: 3, nameRu: 'Тройка Кубков', nameEn: 'Three of Cups', kw: ['дружба, праздник, поддержка', 'третий лишний, перебор веселья', 'friendship, celebration, support', 'a third wheel, excess'] },
  { id: 'four-of-cups', suit: 'cups', num: 4, nameRu: 'Четвёрка Кубков', nameEn: 'Four of Cups', kw: ['апатия, упущенный шанс рядом', 'выход из апатии, новый интерес', 'apathy, a missed offer nearby', 'emerging from apathy, new interest'] },
  { id: 'five-of-cups', suit: 'cups', num: 5, nameRu: 'Пятёрка Кубков', nameEn: 'Five of Cups', kw: ['утрата, сожаление, траур', 'принятие, взгляд на то, что осталось', 'loss, regret, mourning', 'acceptance, seeing what remains'] },
  { id: 'six-of-cups', suit: 'cups', num: 6, nameRu: 'Шестёрка Кубков', nameEn: 'Six of Cups', kw: ['ностальгия, детство, подарок', 'застревание в прошлом', 'nostalgia, childhood, a gift', 'being stuck in the past'] },
  { id: 'seven-of-cups', suit: 'cups', num: 7, nameRu: 'Семёрка Кубков', nameEn: 'Seven of Cups', kw: ['иллюзии выбора, мечты', 'ясность, отказ от миражей', 'illusions of choice, daydreams', 'clarity, dropping the mirage'] },
  { id: 'eight-of-cups', suit: 'cups', num: 8, nameRu: 'Восьмёрка Кубков', nameEn: 'Eight of Cups', kw: ['уход от достигнутого, поиск большего', 'страх уйти, возвращение', 'walking away, seeking more', 'fear of leaving, returning'] },
  { id: 'nine-of-cups', suit: 'cups', num: 9, nameRu: 'Девятка Кубков', nameEn: 'Nine of Cups', kw: ['исполнение желания, довольство', 'пресыщение, пустое удовольствие', 'a wish fulfilled, contentment', 'satiety, hollow pleasure'] },
  { id: 'ten-of-cups', suit: 'cups', num: 10, nameRu: 'Десятка Кубков', nameEn: 'Ten of Cups', kw: ['семейное счастье, гармония', 'разлад в семье, фасад благополучия', 'family happiness, harmony', 'family discord, a facade'] },
  { id: 'page-of-cups', suit: 'cups', num: 11, nameRu: 'Паж Кубков', nameEn: 'Page of Cups', kw: ['весть о чувствах, творческий импульс', 'эмоциональная незрелость', 'a message of feeling, creative impulse', 'emotional immaturity'] },
  { id: 'knight-of-cups', suit: 'cups', num: 12, nameRu: 'Рыцарь Кубков', nameEn: 'Knight of Cups', kw: ['романтика, предложение, шарм', 'непостоянство, красивые обещания', 'romance, a proposal, charm', 'inconstancy, pretty promises'] },
  { id: 'queen-of-cups', suit: 'cups', num: 13, nameRu: 'Королева Кубков', nameEn: 'Queen of Cups', kw: ['эмпатия, забота, глубина', 'растворение в чужих чувствах', 'empathy, care, depth', 'dissolving in others\' feelings'] },
  { id: 'king-of-cups', suit: 'cups', num: 14, nameRu: 'Король Кубков', nameEn: 'King of Cups', kw: ['эмоциональная зрелость, спокойствие', 'подавленные чувства, манипуляция', 'emotional maturity, calm', 'repressed feelings, manipulation'] },
  { id: 'ace-of-swords', suit: 'swords', num: 1, nameRu: 'Туз Мечей', nameEn: 'Ace of Swords', kw: ['ясность, прорыв истины, решение', 'туман, жестокая правда', 'clarity, breakthrough of truth, a decision', 'fog, a harsh truth'] },
  { id: 'two-of-swords', suit: 'swords', num: 2, nameRu: 'Двойка Мечей', nameEn: 'Two of Swords', kw: ['тупик, отложенный выбор', 'развязка, снятая повязка', 'stalemate, a postponed choice', 'resolution, the blindfold removed'] },
  { id: 'three-of-swords', suit: 'swords', num: 3, nameRu: 'Тройка Мечей', nameEn: 'Three of Swords', kw: ['боль сердца, разрыв, горе', 'заживление, отпускание боли', 'heartache, rupture, grief', 'healing, releasing pain'] },
  { id: 'four-of-swords', suit: 'swords', num: 4, nameRu: 'Четвёрка Мечей', nameEn: 'Four of Swords', kw: ['отдых, восстановление, пауза', 'выгорание, отказ от отдыха', 'rest, recovery, a pause', 'burnout, refusing to rest'] },
  { id: 'five-of-swords', suit: 'swords', num: 5, nameRu: 'Пятёрка Мечей', nameEn: 'Five of Swords', kw: ['победа любой ценой, конфликт', 'примирение, цена победы', 'winning at any cost, conflict', 'reconciliation, the cost of victory'] },
  { id: 'six-of-swords', suit: 'swords', num: 6, nameRu: 'Шестёрка Мечей', nameEn: 'Six of Swords', kw: ['переход к спокойствию, отъезд', 'незакрытый багаж, откат', 'passage to calmer waters, departure', 'unfinished baggage, relapse'] },
  { id: 'seven-of-swords', suit: 'swords', num: 7, nameRu: 'Семёрка Мечей', nameEn: 'Seven of Swords', kw: ['хитрость, обход, недосказанность', 'разоблачение, возврат украденного', 'cunning, a workaround, things unsaid', 'exposure, returning what was taken'] },
  { id: 'eight-of-swords', suit: 'swords', num: 8, nameRu: 'Восьмёрка Мечей', nameEn: 'Eight of Swords', kw: ['самоограничение, мнимый плен', 'выход из ловушки мыслей', 'self-restriction, an imagined prison', 'escaping the mind\'s trap'] },
  { id: 'nine-of-swords', suit: 'swords', num: 9, nameRu: 'Девятка Мечей', nameEn: 'Nine of Swords', kw: ['тревога, бессонница, вина', 'отпускание страхов, рассвет', 'anxiety, sleepless nights, guilt', 'releasing fears, dawn'] },
  { id: 'ten-of-swords', suit: 'swords', num: 10, nameRu: 'Десятка Мечей', nameEn: 'Ten of Swords', kw: ['дно цикла, завершение, рассвет далее', 'медленное восстановление', 'rock bottom, an ending, dawn beyond', 'slow recovery'] },
  { id: 'page-of-swords', suit: 'swords', num: 11, nameRu: 'Паж Мечей', nameEn: 'Page of Swords', kw: ['любопытство, наблюдение, весть', 'сплетни, поспешные слова', 'curiosity, watchfulness, news', 'gossip, hasty words'] },
  { id: 'knight-of-swords', suit: 'swords', num: 12, nameRu: 'Рыцарь Мечей', nameEn: 'Knight of Swords', kw: ['стремительное решение, натиск', 'безрассудный рывок, слова-раны', 'a swift decision, an offensive', 'a reckless charge, wounding words'] },
  { id: 'queen-of-swords', suit: 'swords', num: 13, nameRu: 'Королева Мечей', nameEn: 'Queen of Swords', kw: ['ясный ум, прямота, независимость', 'холодность, горький опыт', 'a clear mind, directness, independence', 'coldness, bitter experience'] },
  { id: 'king-of-swords', suit: 'swords', num: 14, nameRu: 'Король Мечей', nameEn: 'King of Swords', kw: ['логика, закон, беспристрастность', 'злоупотребление умом, цинизм', 'logic, law, impartiality', 'misused intellect, cynicism'] },
  { id: 'ace-of-pentacles', suit: 'pentacles', num: 1, nameRu: 'Туз Пентаклей', nameEn: 'Ace of Pentacles', kw: ['новая возможность, семя достатка', 'упущенный шанс, жадный расчёт', 'a new opportunity, a seed of wealth', 'a missed chance, greedy math'] },
  { id: 'two-of-pentacles', suit: 'pentacles', num: 2, nameRu: 'Двойка Пентаклей', nameEn: 'Two of Pentacles', kw: ['баланс дел, гибкость, жонглирование', 'перегруз, разрываешься', 'balancing priorities, adaptability', 'overload, being torn'] },
  { id: 'three-of-pentacles', suit: 'pentacles', num: 3, nameRu: 'Тройка Пентаклей', nameEn: 'Three of Pentacles', kw: ['мастерство, команда, признание', 'работа без отдачи, разнобой', 'craftsmanship, teamwork, recognition', 'unrewarded work, misalignment'] },
  { id: 'four-of-pentacles', suit: 'pentacles', num: 4, nameRu: 'Четвёрка Пентаклей', nameEn: 'Four of Pentacles', kw: ['сбережение, контроль, устойчивость', 'скупость, зажатость', 'saving, control, stability', 'stinginess, clinging'] },
  { id: 'five-of-pentacles', suit: 'pentacles', num: 5, nameRu: 'Пятёрка Пентаклей', nameEn: 'Five of Pentacles', kw: ['нужда, полоса лишений', 'помощь рядом, выход из нужды', 'hardship, a lean stretch', 'help nearby, recovery'] },
  { id: 'six-of-pentacles', suit: 'pentacles', num: 6, nameRu: 'Шестёрка Пентаклей', nameEn: 'Six of Pentacles', kw: ['щедрость, помощь, обмен', 'долг с условиями, неравный обмен', 'generosity, help, exchange', 'strings attached, unequal exchange'] },
  { id: 'seven-of-pentacles', suit: 'pentacles', num: 7, nameRu: 'Семёрка Пентаклей', nameEn: 'Seven of Pentacles', kw: ['терпение, оценка урожая', 'нетерпение, сомнение в плоде', 'patience, assessing the harvest', 'impatience, doubting the fruit'] },
  { id: 'eight-of-pentacles', suit: 'pentacles', num: 8, nameRu: 'Восьмёрка Пентаклей', nameEn: 'Eight of Pentacles', kw: ['ремесло, оттачивание, усердие', 'рутина без смысла, халтура', 'craft, honing, diligence', 'meaningless routine, sloppiness'] },
  { id: 'nine-of-pentacles', suit: 'pentacles', num: 9, nameRu: 'Девятка Пентаклей', nameEn: 'Nine of Pentacles', kw: ['самодостаточность, заслуженный комфорт', 'показное благополучие', 'self-sufficiency, earned comfort', 'showy wellbeing'] },
  { id: 'ten-of-pentacles', suit: 'pentacles', num: 10, nameRu: 'Десятка Пентаклей', nameEn: 'Ten of Pentacles', kw: ['наследие, род, богатство семьи', 'споры о наследстве, шаткость основ', 'legacy, family, generational wealth', 'inheritance disputes, shaky roots'] },
  { id: 'page-of-pentacles', suit: 'pentacles', num: 11, nameRu: 'Паж Пентаклей', nameEn: 'Page of Pentacles', kw: ['ученичество, новая профессия', 'прокрастинация, мечты без дела', 'apprenticeship, a new skill', 'procrastination, idle dreams'] },
  { id: 'knight-of-pentacles', suit: 'pentacles', num: 12, nameRu: 'Рыцарь Пентаклей', nameEn: 'Knight of Pentacles', kw: ['методичность, надёжность', 'застой, упрямая рутина', 'methodical progress, reliability', 'stagnation, stubborn routine'] },
  { id: 'queen-of-pentacles', suit: 'pentacles', num: 13, nameRu: 'Королева Пентаклей', nameEn: 'Queen of Pentacles', kw: ['практичная забота, уют, ресурс', 'самозабвение в заботах', 'practical care, comfort, resource', 'losing oneself in caretaking'] },
  { id: 'king-of-pentacles', suit: 'pentacles', num: 14, nameRu: 'Король Пентаклей', nameEn: 'King of Pentacles', kw: ['достаток, зрелый успех, щедрый итог', 'одержимость статусом, скупость', 'affluence, mature success, generosity', 'status obsession, miserliness'] },
] as const;

export type TarotSpreadId = 'daily' | 'yesno' | 'three' | 'celtic';

export interface TarotSpreadDef {
  id: TarotSpreadId;
  cards: number;
  /** Позиции: [ru, en] на каждую карту */
  positions: [string, string][];
  free: boolean; // бесплатен ли (карта дня — 1 раз в день)
}

export const TAROT_SPREADS: Record<TarotSpreadId, TarotSpreadDef> = {
  daily: { id: 'daily', cards: 1, free: true, positions: [['Карта дня', 'Card of the day']] },
  yesno: { id: 'yesno', cards: 1, free: false, positions: [['Ответ', 'The answer']] },
  three: {
    id: 'three', cards: 3, free: false,
    positions: [['Прошлое', 'Past'], ['Настоящее', 'Present'], ['Будущее', 'Future']],
  },
  celtic: {
    id: 'celtic', cards: 10, free: false,
    positions: [
      ['Суть ситуации', 'The heart of the matter'], ['Что пересекает', 'What crosses it'],
      ['Корни', 'The root'], ['Уходящее', 'What is passing'], ['Возможное', 'What may come'],
      ['Ближайшее будущее', 'Near future'], ['Ты сам', 'Yourself'], ['Окружение', 'Environment'],
      ['Надежды и страхи', 'Hopes and fears'], ['Итог', 'Outcome'],
    ],
  },
};

export interface DrawnTarotCard {
  cardId: string;
  position: number;
  reversed: boolean;
}

/** Честная тасовка Фишера-Йетса; rng подменяется в тестах */
export function drawCards(count: number, opts?: { allowReversed?: boolean; rng?: () => number }): DrawnTarotCard[] {
  const rng = opts?.rng ?? Math.random;
  const allowReversed = opts?.allowReversed !== false;
  const ids = TAROT_DECK.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count).map((cardId, position) => ({
    cardId,
    position,
    reversed: allowReversed ? rng() < 0.5 : false,
  }));
}

export function getTarotCard(id: string): TarotCard | undefined {
  return TAROT_DECK.find((c) => c.id === id);
}
