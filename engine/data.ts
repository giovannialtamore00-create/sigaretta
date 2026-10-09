export type Mode = 'easy' | 'gram';

export const CRITERIA: Record<Mode, string[]> = {
  easy: ['Chi?', 'Cosa fa?', 'Come?', 'Dove?', 'Con chi?', 'Quando?', 'Perché?'],
  gram: ['Soggetto', 'Apposizione', 'Verbo transitivo', 'Complemento oggetto', 'Complemento di specificazione', 'Complemento di modo', 'Complemento di causa'],
};

// Frasi dei bot, dal prototipo (costante BP): una lista per turno.
export const BOT_PHRASES: Record<Mode, string[][]> = {
  easy: [
    ['Un pirata', 'La nonna', 'Il mio vicino', 'Un gatto', 'Il prof di storia', 'Un astronauta'],
    ['mangia sassi', 'balla il tango', 'litiga col frigo', 'vende nuvole', 'canta sotto la doccia', 'insegue un piccione'],
    ['di nascosto', 'con eleganza', 'a testa in giù', 'senza pantaloni', 'piangendo di gioia', 'in silenzio'],
    ['in cucina', 'sulla luna', 'al supermercato', 'in tangenziale', 'dentro un armadio', 'a Milano'],
    ['con un pinguino', 'con la zia Rosa', 'con un fantasma', 'con Napoleone', 'con nessuno', 'con un tostapane'],
    ['ieri a mezzanotte', "domani all'alba", "durante l'esame", 'a Natale', 'ogni lunedì', 'nel 1492'],
    ['perché aveva fame', 'per colpa del meteo', 'per vincere una scommessa', 'perché lo diceva il papa', 'per noia', 'perché era tutto un sogno'],
  ],
  gram: [
    ['Il cugino di Marco', 'Una zanzara', 'Il sindaco', 'Mia nonna', 'Un robot', 'Il postino'],
    ['campione di bocce', 'esperto di meteo', 'amante dei carciofi', 'ex pirata', 'collezionista di calzini', 'poeta distratto'],
    ['divora', 'abbraccia', 'insegue', 'vende', 'lancia', 'nasconde'],
    ['un panettone', 'la bicicletta', 'tre cipolle', 'il telecomando', 'un dinosauro', 'la lavatrice'],
    ['del vicino', 'della nonna', 'di Garibaldi', 'del supermercato', 'di cartone', 'della domenica'],
    ['con delicatezza', 'a squarciagola', 'senza fretta', 'con le mani nei capelli', 'in punta di piedi', 'a occhi chiusi'],
    ['per un colpo di sole', 'per amore', 'per pura noia', 'per via del traffico', 'per vendetta', 'per colpa del gatto'],
  ],
};
