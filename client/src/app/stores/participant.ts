import { Consumer, Producer } from "mediasoup-client/types";
import { create } from "zustand";

interface ParticipantState {
  self: string | undefined;
  participants: Record<string, (Consumer | undefined)[]>;
  producers: Producer[];
  localStream: MediaStream | null;

  setSelf: (id: string | undefined) => void;

  addParticipant: (
    participantId: string,
    consumer: Consumer | undefined
  ) => void;
  removeParticipant: (participantId: string) => void;

  addProducer: (producer: Producer | undefined) => void;
  removeProducer: (produerId: string) => void;

  setLocalStream: (stream: MediaStream | null) => void;
}

export const useParticipantStore = create<ParticipantState>((set) => ({
  self: "",
  participants: {},
  producers: [],
  consumers: [],
  localStream: null,

  setSelf: (self) => set({ self }),

  addParticipant: (participantId, consumer) =>
    set((state) => {
      const current = state.participants[participantId] || [];
      return {
        participants: {
          ...state.participants,
          [participantId]: [...current, consumer],
        },
      };
    }),
  removeParticipant: (participantId) =>
    set((state) => {
      const participants = { ...state.participants };
      delete participants[participantId];
      return { participants };
    }),

  addProducer: (producer) =>
    set((state) => {
      if (!producer) return { producers: state.producers };
      return { producers: [...state.producers, producer] };
    }),
  removeProducer: (producerId) =>
    set((state) => ({
      producers: state.producers.filter(
        (producer) => producer.id !== producerId
      ),
    })),

  setLocalStream: (stream) => set({ localStream: stream }),
}));
