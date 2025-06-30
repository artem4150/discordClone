'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../store/useAuth';
import api, {
  guild as guildApi,
  channel as channelApi,
  user as userApi,
  getIceServers
} from '../../lib/api';
import { 
  Guild, 
  Channel, 
  Message, 
  User,
  ChannelType
} from '../../lib/generated';
import { Gateway } from '../../lib/ws';
import { VoiceGateway, VoiceEvent } from '../../lib/voiceGateway';
import { getMessages as getChannelMessages } from '../../lib/api';
import { normalizeUUID } from '../../lib/uuid';

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, clearAuth } = useAuth();
  const currentUserId = user?.id ? normalizeUUID(user.id) : '';
  
  // Конфигурация TURN-сервера из переменных окружения
  const turnServerConfig = process.env.NEXT_PUBLIC_TURN_URL 
    ? {
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || ''
      }
    : null;

  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeGuild, setActiveGuild] = useState<Guild | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [voiceUsers, setVoiceUsers] = useState<User[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChannelType>(ChannelType.TEXT);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [voiceGateway, setVoiceGateway] = useState<VoiceGateway | null>(null);
  const [isInVoiceChannel, setIsInVoiceChannel] = useState(false);
  const [voiceNotifications, setVoiceNotifications] = useState<{userId: string, action: 'join' | 'leave'}[]>([]);
  const [voiceError, setVoiceError] = useState('');
  
  // Голосовые состояния
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [activeSpeakers, setActiveSpeakers] = useState<Record<string, boolean>>({});
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  // Доступные аудио устройства и выбранные id
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState('');
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState('');

  // При смене устройства вывода обновляем все аудио элементы
  useEffect(() => {
    Object.values(audioElements).forEach(a => {
      if (selectedOutputDeviceId && (a as any).setSinkId) {
        (a as any).setSinkId(selectedOutputDeviceId).catch(() => {});
      }
    });
  }, [selectedOutputDeviceId, audioElements]);
  
  // Состояния для приглашения пользователей
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteError, setInviteError] = useState('');
  
  // Состояния для приглашения по ссылке
  const [isInviteLinkModalOpen, setIsInviteLinkModalOpen] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Создаем карту пользователей для отображения никнеймов в чате
  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    
    // Добавляем текущего пользователя
    if (user) {
      const normalizedId = normalizeUUID(user.id);
      map[normalizedId] = {
        ...user,
        username: user.username || "You"
      };
    }
    
    // Добавляем участников сервера
    members.forEach(member => {
      const normalizedId = normalizeUUID(member.id);
      map[normalizedId] = {
        ...member,
        username: member.username || `User-${normalizedId.slice(0,4)}`
      };
    });
    
    return map;
  }, [user, members]);

  // Автоскроллинг к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Очистка уведомлений о голосовой активности
  useEffect(() => {
    if (voiceNotifications.length > 0) {
      const timer = setTimeout(() => {
        setVoiceNotifications([]);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [voiceNotifications]);

  // Получение списка аудио устройств
  useEffect(() => {
    const updateDevices = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) {
        console.warn('MediaDevices API not available');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setInputDevices(inputs);
        setOutputDevices(outputs);
        if (!selectedInputDeviceId && inputs[0]) {
          setSelectedInputDeviceId(inputs[0].deviceId);
        }
        if (!selectedOutputDeviceId && outputs[0]) {
          setSelectedOutputDeviceId(outputs[0].deviceId);
        }
      } catch (err) {
        console.error('Failed to enumerate devices', err);
      }
    };

    updateDevices();

    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', updateDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
      };
    }

    return;
  }, []);

  // Проверка аутентификации и загрузка данных
  useEffect(() => {
    loadInitialData();
  }, [token, router]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadGuilds();
      setLoading(false);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setErrorMessage('Failed to load data. Please try again.');
      setLoading(false);
    }
  };

  const transformChannels = (channels: any[]): Channel[] => {
    return channels.map(channel => ({
      id: channel.id,
      guildId: channel.guildId,
      name: channel.name,
      type: channel.type,
      createdAt: channel.createdAt
    }));
  };

  // Загрузка ICE-серверов
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const servers = await getIceServers();
        
        // Добавляем TURN-сервер из переменных окружения
        if (turnServerConfig) {
          servers.push(turnServerConfig);
        }
        
        // Добавляем fallback STUN-сервер
        if (servers.length === 0) {
          servers.push({ urls: 'stun:stun.l.google.com:19302' });
        }
        
        setIceServers(servers);
      } catch (error) {
        console.error('Failed to fetch ICE servers:', error);
        
        // Используем fallback, если не удалось получить серверы
        const fallbackServers = turnServerConfig 
          ? [turnServerConfig, { urls: 'stun:stun.l.google.com:19302' }] 
          : [{ urls: 'stun:stun.l.google.com:19302' }];
        
        setIceServers(fallbackServers);
      }
    };
    
    fetchIceServers();
  }, []);

  // Загрузка серверов
  const loadGuilds = useCallback(async () => {
    try {
      const response = await guildApi.getGuilds();
      setGuilds(response.data);
      if (response.data.length > 0) {
        setActiveGuild(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load guilds:', error);
      setErrorMessage('Failed to load servers.');
    }
  }, []);

  // Загрузка каналов и участников при смене сервера
  useEffect(() => {
    if (activeGuild) {
      loadChannelsAndMembers();
    } else {
      setChannels([]);
      setMembers([]);
      setActiveChannel(null);
    }
  }, [activeGuild]);

  // Функция для загрузки каналов и участников
  const loadChannelsAndMembers = useCallback(async () => {
    if (!activeGuild) return;

    try {
      setLoading(true);
      
      const [channelsResponse, membersResponse] = await Promise.all([
        channelApi.getChannels(activeGuild.id),
        guildApi.getMembers(activeGuild.id)
      ]);

      // Преобразование каналов
      const transformedChannels = transformChannels(channelsResponse.data);
      setChannels(transformedChannels);
      
      // Преобразование участников с нормализацией ID и загрузкой ника
      const transformedMembers = await Promise.all(
        membersResponse.data.map(async (member: any) => {
          const uid = normalizeUUID(member.userId || member.id);
          try {
            const res = await userApi.getById(uid);
            return { id: uid, username: res.data.username || '', email: res.data.email || '' } as User;
          } catch (err) {
            console.warn('Failed to fetch user info', uid, err);
            return { id: uid, username: '', email: '' } as User;
          }
        })
      );

      setMembers(transformedMembers);
      
      if (transformedChannels.length > 0) {
        const textChannel = transformedChannels.find(c => c.type === ChannelType.TEXT);
        setActiveChannel(textChannel || transformedChannels[0]);
      } else {
        setActiveChannel(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setErrorMessage('Failed to load channels and members.');
      setLoading(false);
    }
  }, [activeGuild]);

  // Загрузка сообщений для текстового канала
  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) return;
    
    try {
      const response = await getChannelMessages(channelId, 50);
      
      // Преобразование сообщений с нормализацией ID
      const transformedMessages = response.map(msg => ({
        ...msg,
        channelId: normalizeUUID(msg.channelId),
        messageId: normalizeUUID(msg.messageId),
        senderId: normalizeUUID(msg.senderId),
      }));
      
      setMessages(transformedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  // Обработка WebSocket сообщений
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== ChannelType.TEXT || !token) return;

    setMessages([]); // Очистка сообщений при переключении канала

    // Закрытие предыдущего WebSocket-соединения
    if (gateway) {
        gateway.disconnect();
        setGateway(null);
    }

    // Инициализация нового WebSocket-соединения
    const newGateway = new Gateway(token, activeChannel.id);
    newGateway.connect();
    setGateway(newGateway);

    // Подписка на сообщения в реальном времени
    const handleMessage = (msg: Message) => {
        // Нормализуем senderId перед добавлением
        const normalizedMsg = {
          ...msg,
          senderId: normalizeUUID(msg.senderId)
        };
        setMessages(prev => [...prev, normalizedMsg]);
    };

    newGateway.onMessage(handleMessage);

    // Загрузка исторических сообщений
    loadMessages(activeChannel.id);

    // Очистка при размонтировании
    return () => {
        newGateway.offMessage(handleMessage);
        newGateway.disconnect();
    };
  }, [activeChannel, token, loadMessages]);

  // Создание нового сервера
  const createNewGuild = async () => {
    const guildName = prompt('Enter server name:');
    if (!guildName) return;
    
    try {
      const response = await guildApi.createGuild({ name: guildName });
      setGuilds(prev => [...prev, response.data]);
      setActiveGuild(response.data);
    } catch (error) {
      console.error('Failed to create server:', error);
      alert('Failed to create server');
    }
  };
  // Инициализация голосового соединения
  const initVoiceConnection = async () => {
    if (!voiceGateway) return;

    try {
      // Запрос доступа к микрофону
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedInputDeviceId ? { exact: selectedInputDeviceId } : undefined,
          noiseSuppression: true,
          echoCancellation: true,
        },
        video: false,
      };

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      
      // Запускаем обнаружение речи
      startSpeakingDetection(stream);
      
      // Уведомляем о подключении после получения медиа
      voiceGateway.send({ type: 'join' });

      // Создаем пиринговые соединения с другими участниками
      voiceUsers.forEach(user => {
        const userId = normalizeUUID(user.id);
        if (userId !== currentUserId) {
          createPeerConnection(userId, stream);
        }
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setVoiceError('Microphone access denied');
    }
  };

  // Создание пирингового соединения
  const createPeerConnection = (userId: string, stream?: MediaStream) => {
    const config: RTCConfiguration = {
      iceServers: [
        ...iceServers,
        { urls: 'stun:stun.l.google.com:19302' } // Fallback STUN
      ]
    };
    
    const pc = new RTCPeerConnection(config);
    
    // Добавляем локальный поток
    const audioStream = stream || localStream;
    if (audioStream) {
      audioStream.getTracks().forEach(track => {
        pc.addTrack(track, audioStream);
      });
    }
    
    // Обработка ICE кандидатов
    pc.onicecandidate = (event) => {
      if (event.candidate && voiceGateway) {
        voiceGateway.send({
          type: 'candidate',
          target: userId,
          payload: { candidate: event.candidate }
        });
      }
    };
    
    // Получение удаленного потока
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: remoteStream
      }));
      
      // Создаем аудио элемент для воспроизведения
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.volume = 1.0;
      if (selectedOutputDeviceId && (audio as any).setSinkId) {
        (audio as any).setSinkId(selectedOutputDeviceId).catch(() => {});
      }
      
      setAudioElements(prev => ({
        ...prev,
        [userId]: audio
      }));
    };
    
    // Создаем предложение (offer)
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        if (voiceGateway && pc.localDescription) {
          voiceGateway.send({
            type: 'offer',
            target: userId,
            payload: { offer: pc.localDescription }
          });
        }
      })
      .catch(error => {
        console.error('Error creating offer:', error);
      });
    
    // Сохраняем соединение
    setPeerConnections(prev => ({
      ...prev,
      [userId]: pc
    }));
    
    return pc;
  };

  // Обработка сигналов WebRTC
  const handleSignal = (userId: string, data: any) => {
    let pc = peerConnections[userId];
    if (!pc) {
      pc = createPeerConnection(userId);
    }
    
    if (!pc) return;
    
    switch (data.type) {
      case 'offer':
        pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            if (voiceGateway && pc.localDescription) {
              voiceGateway.send({
                type: 'answer',
                target: userId,
                payload: { answer: pc.localDescription }
              });
            }
          })
          .catch(error => {
            console.error('Error handling offer:', error);
          });
        break;
        
      case 'answer':
        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch(error => {
            console.error('Error setting remote description:', error);
          });
        break;
        
      case 'candidate':
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(error => {
            console.error('Error adding ICE candidate:', error);
          });
        break;
    }
  };
  // Вход в голосовой канал
const joinVoiceChannel = useCallback((channelId: string) => {
  if (!token) return;

  // 1) Отключаемся от предыдущего канала, если он есть
  if (voiceGateway) {
    voiceGateway.disconnect();
    setVoiceGateway(null);
    setIsInVoiceChannel(false);
    setVoiceUsers([]);
    stopSpeakingDetection();
  }

  // 2) Создаём новый голосовой шлюз и сохраняем его в стейте
  const gateway = new VoiceGateway(token, channelId);
  setVoiceGateway(gateway);

  // 3) Универсальный обработчик событий от VoiceGateway

  // Обработчик всех входящих событий от сервера
  const onEvent = (event: VoiceEvent) => {
  const rawUserId = event.userId ?? '';
  const peerId    = normalizeUUID(rawUserId);

  switch (event.type) {
    case 'auth-response':
      if (event.success) {
        initVoiceConnection();
      } else {
        setVoiceError(event.error || 'Voice authentication failed');
      }
      break;

    case 'join':
      if (peerId && !voiceUsers.some(u => normalizeUUID(u.id) === peerId)) {
        const info = userMap[peerId];
        setVoiceUsers(prev => [
          ...prev,
          { id: peerId, username: info?.username || `User-${peerId.slice(0, 4)}`, email: info?.email || '' } as User
        ]);
        if (localStream && peerId !== currentUserId) {
          createPeerConnection(peerId, localStream);
        }
        // сообщаем о своём присутствии новому пользователю
        voiceGateway?.send({ type: 'join' });
      }
      setVoiceNotifications(prev => [
        ...prev,
        { userId: peerId, action: 'join' }
      ]);
      break;

    case 'leave':
      // 1) удаляем из списка пользователей
      setVoiceUsers(prev =>
        prev.filter(u => normalizeUUID(u.id) !== peerId)
      );

      // 2) закрываем/удаляем RTCPeerConnection
      peerConnections[peerId]?.close();
      setPeerConnections(pc => {
        const copy = { ...pc };
        delete copy[peerId];
        return copy;
      });

      // 3) удаляем удалённый медиапоток
      setRemoteStreams(rs => {
        const copy = { ...rs };
        delete copy[peerId];
        return copy;
      });

      // 4) удаляем индикатор говорящего
      setActiveSpeakers(prev => {
        // prev имеет тип Record<string, boolean>
        const newSpeakers = { ...prev };   // тоже Record<string, boolean>
        delete newSpeakers[peerId];        // TS не "понимает", что там потенциально может быть undefined
        return newSpeakers;                // возвращается Record<string, boolean>
      });

      setVoiceNotifications(prev => [
        ...prev,
        { userId: peerId, action: 'leave' }
      ]);
      break;

    case 'signal':
      if (event.data) {
        handleSignal(peerId, event.data);
      }
      break;

    case 'user-speaking':
      if (typeof event.isSpeaking === 'boolean') {
        setActiveSpeakers(prev => ({
          ...prev,
          [peerId]: event.isSpeaking as boolean
        }));
      }
      break;
  }
};


  // 4) Навешиваем обработчик и подключаемся
  gateway.onEvent(onEvent);
  gateway.connect();
  setIsInVoiceChannel(true);

  // 5) При размонтировании — отключаемся
  return () => {
    gateway.offEvent(onEvent);
    gateway.disconnect();
  };
}, [
  token,
  voiceGateway,
  voiceUsers,
  localStream,
  peerConnections,
  currentUserId,
  initVoiceConnection,
  createPeerConnection,
  handleSignal,
  userMap,
  selectedOutputDeviceId,
  selectedInputDeviceId
]);





  // Запуск обнаружения речи
  const startSpeakingDetection = (stream: MediaStream) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let lastSpeakingState = false;
      const speakingThreshold = -45; // Порог громкости (дБ)
      
      speakingCheckIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        const average = sum / bufferLength;
        const decibels = 20 * Math.log10(average / 255);
        const isSpeaking = decibels > speakingThreshold;
        
        // Обновляем уровень громкости для визуализации
        setVolumeLevel(Math.min(100, Math.round((average / 255) * 100)));
        
        // Отправляем событие только при изменении состояния
        if (isSpeaking !== lastSpeakingState) {
          lastSpeakingState = isSpeaking;
          voiceGateway?.send({
            type: 'user-speaking',
            payload: { isSpeaking }
          });
        }
      }, 200); // Проверка каждые 200 мс
    } catch (error) {
      console.error('Error starting speaking detection:', error);
    }
  };

  // Остановка обнаружения речи
  const stopSpeakingDetection = () => {
    if (speakingCheckIntervalRef.current) {
      clearInterval(speakingCheckIntervalRef.current);
      speakingCheckIntervalRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
  };

  // Выход из голосового канала
  const leaveVoiceChannel = () => {
    if (voiceGateway) {
      voiceGateway.disconnect();
      setVoiceGateway(null);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    stopSpeakingDetection();
    
    // Закрываем все пиринговые соединения
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({});
    
    setVoiceUsers([]);
    setRemoteStreams({});
    setAudioElements({});
    setActiveSpeakers({});
    setIsInVoiceChannel(false);
    setVolumeLevel(0);
  };

  // Отправка сообщения
  const sendMessage = () => {
    if (!newMessage.trim() || !gateway || !activeChannel) return;
    
    gateway.sendMessage(newMessage);
    setNewMessage('');
  };

  // Выход из аккаунта
  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Создание нового канала
  const createNewChannel = async () => {
    if (!activeGuild || !newChannelName.trim()) return;
    
    try {
      await channelApi.createChannel(activeGuild.id, {
        name: newChannelName,
        type: newChannelType
      });
      
      // Перезагружаем каналы после создания
      await loadChannelsAndMembers();
      
      // Сброс формы
      setNewChannelName('');
      setNewChannelType(ChannelType.TEXT);
      setIsCreatingChannel(false);
    } catch (error) {
      console.error('Failed to create channel:', error);
      alert('Failed to create channel');
    }
  };

  // Приглашение пользователя на сервер по ID
  const inviteUser = async () => {
    if (!activeGuild || !inviteUserId.trim()) return;
    
    try {
      // Отправляем приглашение на сервер
      await guildApi.inviteMember(activeGuild.id, inviteUserId);
      
      // Обновляем список участников
      const membersResponse = await guildApi.getMembers(activeGuild.id);
      const transformedMembers = membersResponse.data.map(member => ({
        id: normalizeUUID(member.id),
        username: member.username || "",
        email: member.email || ""
      }));
      setMembers(transformedMembers);
      
      // Сброс формы
      setIsInviteModalOpen(false);
      setInviteUserId('');
      setInviteError('');
    } catch (error) {
      console.error('Failed to invite user:', error);
      setInviteError('Failed to invite user. Please check the user ID and try again.');
    }
  };

  // Генерация ссылки для приглашения
  const createInvitationLink = async () => {
    if (!activeGuild) return;
    
    try {
      const response = await guildApi.createInvitation(activeGuild.id);
      const code = response.data.code;
      const link = `${window.location.origin}/invite/${code}`;
      setInvitationLink(link);
      setIsInviteLinkModalOpen(true);
    } catch (error) {
      console.error('Failed to create invitation', error);
      setErrorMessage('Failed to create invitation link');
    }
  };

  // Рендер каналов
  const renderChannels = (type: ChannelType) => {
    const filteredChannels = channels.filter(c => c.type === type);
    
    return (
      <>
        <div className="flex justify-between items-center">
          <div className="text-gray-400 text-sm font-semibold px-2 py-1">
            {type === ChannelType.TEXT ? 'TEXT CHANNELS' : 'VOICE CHANNELS'}
          </div>
          {activeGuild && (
            <button 
              onClick={() => {
                setIsCreatingChannel(true);
                setNewChannelType(type);
              }}
              className="text-gray-400 hover:text-white text-sm"
              title={`Create ${type.toLowerCase()} channel`}
            >
              +
            </button>
          )}
        </div>
        
        {filteredChannels.length > 0 ? (
          filteredChannels.map(channel => (
            <div
              key={channel.id}
              className={`px-3 py-1 rounded cursor-pointer flex items-center ${
                activeChannel?.id === channel.id
                  ? 'bg-gray-700'
                  : 'hover:bg-gray-700'
              }`}
              onClick={() => {
                setActiveChannel(channel);
                
                // Выход из голосового канала при переходе в текстовый
                if (channel.type !== ChannelType.VOICE && voiceGateway) {
                  leaveVoiceChannel();
                }
                
                // Вход в голосовой канал
                if (channel.type === ChannelType.VOICE) {
                  joinVoiceChannel(channel.id);
                }
              }}
            >
              {type === ChannelType.TEXT ? (
                <span className="mr-1">#</span>
              ) : (
                <span className="mr-1">🔊</span>
              )}
              {channel.name}
            </div>
          ))
        ) : (
          <div className="px-3 py-1 text-gray-500 text-sm">
            No {type.toLowerCase()} channels
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-800 text-white items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex h-screen bg-gray-800 text-white items-center justify-center">
        <div className="text-xl text-red-500">{errorMessage}</div>
        <button 
          onClick={loadInitialData}
          className="ml-4 px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-800 text-white overflow-hidden">
      {/* Панель серверов */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-4">
        {guilds.map(guild => (
          <div 
            key={guild.id}
            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all ${
              activeGuild?.id === guild.id 
                ? 'bg-indigo-600 rounded-2xl' 
                : 'bg-gray-700 hover:bg-indigo-500 hover:rounded-2xl'
            }`}
            onClick={() => setActiveGuild(guild)}
          >
            {guild.name.charAt(0)}
          </div>
        ))}
        
        <button 
          className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center hover:bg-green-500"
          onClick={createNewGuild}
        >
          +
        </button>
      </div>

      {/* Панель каналов */}
      <div className="w-60 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700 font-bold flex justify-between items-center">
          <span>{activeGuild?.name || 'Select Server'}</span>
          {activeGuild && (
            <div className="flex space-x-2">
              {/* Кнопка генерации ссылки приглашения */}
              <button 
                onClick={createInvitationLink}
                className="text-gray-400 hover:text-white"
                title="Generate Invite Link"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
              
              {/* Кнопка приглашения по ID */}
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="text-gray-400 hover:text-white"
                title="Invite User by ID"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
              
              {/* Кнопка создания канала */}
              <button 
                onClick={() => setIsCreatingChannel(true)}
                className="text-gray-400 hover:text-white text-xl"
                title="Create Channel"
              >
                +
              </button>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {/* Форма создания канала */}
          {isCreatingChannel && (
            <div className="mb-4 p-2 bg-gray-900 rounded-md">
              <input
                type="text"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="w-full p-2 mb-2 bg-gray-800 rounded text-white"
              />
              
              <div className="flex mb-2">
                <button
                  className={`flex-1 mr-1 p-1 rounded ${
                    newChannelType === ChannelType.TEXT 
                      ? 'bg-indigo-600' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setNewChannelType(ChannelType.TEXT)}
                >
                  Text
                </button>
                <button
                  className={`flex-1 ml-1 p-1 rounded ${
                    newChannelType === ChannelType.VOICE 
                      ? 'bg-indigo-600' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setNewChannelType(ChannelType.VOICE)}
                >
                  Voice
                </button>
              </div>
              
              <div className="flex">
                <button
                  className="flex-1 mr-1 p-1 bg-green-600 hover:bg-green-500 rounded"
                  onClick={createNewChannel}
                >
                  Create
                </button>
                <button
                  className="flex-1 ml-1 p-1 bg-gray-600 hover:bg-gray-500 rounded"
                  onClick={() => setIsCreatingChannel(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {renderChannels(ChannelType.TEXT)}
          
          <div className="mt-4">
            {renderChannels(ChannelType.VOICE)}
          </div>
        </div>
        
        <div className="p-3 bg-gray-900 flex items-center">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center mr-2">
            {user?.username?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <div className="font-medium">{user?.username || 'Unknown User'}</div>
            <div className="text-xs text-gray-400">
              #{user?.id?.slice(0, 4) || '0000'}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-gray-400 hover:text-white"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className="flex-1 flex flex-col bg-gray-700">
        {activeChannel ? (
          <>
            <div className="p-4 border-b border-gray-600 flex items-center">
              <span className="mr-2">
                {activeChannel.type === ChannelType.TEXT ? '#' : '🔊'}
              </span>
              <span className="font-bold">{activeChannel.name}</span>
              
              {activeChannel.type === ChannelType.VOICE && isInVoiceChannel && (
                <div className="ml-4 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                  <span className="text-green-400 text-sm">Live</span>
                </div>
              )}
            </div>
            
            {activeChannel.type === ChannelType.TEXT ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(message => {
                    // Нормализуем ID отправителя
                    const senderId = normalizeUUID(message.senderId);
                    
                    // Находим отправителя в карте пользователей
                    const sender = userMap[senderId] || {
                      username: `User-${senderId.slice(0,4)}`,
                      id: senderId
                    };
                    
                    return (
                      <div key={message.messageId} className="flex hover:bg-gray-800 p-2 rounded">
                        <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center mr-3">
                          {sender.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold">
                            <span>{sender.username}</span>
                            <span className="ml-2 text-xs text-gray-400">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div>{message.content}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                
                <div className="p-4">
                  <div className="flex items-center bg-gray-800 rounded-lg px-4">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={`Message #${activeChannel.name}`}
                      className="flex-1 bg-transparent py-3 outline-none"
                      onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button 
                      onClick={sendMessage}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="text-2xl font-bold mb-4">🔊 {activeChannel.name}</div>
                
                {!isInVoiceChannel ? (
                  <>
                    <div className="mb-4 flex space-x-2">
                      <select
                        value={selectedInputDeviceId}
                        onChange={(e) => setSelectedInputDeviceId(e.target.value)}
                        className="bg-gray-800 rounded p-2 text-sm"
                      >
                        {inputDevices.map(dev => (
                          <option key={dev.deviceId} value={dev.deviceId}>{dev.label || dev.deviceId}</option>
                        ))}
                      </select>
                      <select
                        value={selectedOutputDeviceId}
                        onChange={(e) => setSelectedOutputDeviceId(e.target.value)}
                        className="bg-gray-800 rounded p-2 text-sm"
                      >
                        {outputDevices.map(dev => (
                          <option key={dev.deviceId} value={dev.deviceId}>{dev.label || dev.deviceId}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => joinVoiceChannel(activeChannel.id)}
                      className="px-6 py-3 bg-indigo-600 rounded hover:bg-indigo-500"
                    >
                      Join Voice Channel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4 max-w-2xl">
                      {/* Локальный пользователь */}
                      <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center relative">
                        {activeSpeakers[currentUserId] && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                        )}
                        <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mb-2">
                          {user?.username?.charAt(0) || 'U'}
                        </div>
                        <div className="font-bold">You</div>
                        <div className="text-xs text-gray-400">
                          {activeSpeakers[currentUserId] ? 'Speaking...' : 'Silent'}
                        </div>
                        
                        {/* Визуализатор громкости */}
                        <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-100"
                            style={{ width: `${volumeLevel}%` }}
                          ></div>
                        </div>
                        
                        {/* Анимация волны для активного говорящего */}
                        {activeSpeakers[currentUserId] && (
                          <div className="absolute -bottom-2 w-full flex justify-center space-x-1">
                            {[1, 2, 3, 4, 3, 2].map((height, i) => (
                              <div 
                                key={i} 
                                className="w-1 bg-green-400 rounded-sm animate-pulse"
                                style={{ 
                                  height: `${height * 4}px`,
                                  animationDelay: `${i * 0.1}s`,
                                  animationDuration: '0.8s'
                                }}
                              ></div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Удаленные пользователи */}
                      {voiceUsers.map(user => {
                        const normalizedId = normalizeUUID(user.id);
                        const isSpeaking = activeSpeakers[normalizedId];
                        
                        return (
                          <div 
                            key={normalizedId} 
                            className="bg-gray-800 rounded-lg p-4 flex flex-col items-center relative"
                          >
                            {isSpeaking && (
                              <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                            )}
                            <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mb-2">
                              {user.username?.charAt(0) || 'U'}
                            </div>
                            <div className="font-bold">{user.username || 'Unknown'}</div>
                            <div className="text-xs text-gray-400">
                              {isSpeaking ? 'Speaking...' : 'Silent'}
                            </div>
                            
                            {/* Анимация волны для активного говорящего */}
                            {isSpeaking && (
                              <div className="absolute -bottom-2 w-full flex justify-center space-x-1">
                                {[1, 2, 3, 4, 3, 2].map((height, i) => (
                                  <div 
                                    key={i} 
                                    className="w-1 bg-green-400 rounded-sm animate-pulse"
                                    style={{ 
                                      height: `${height * 4}px`,
                                      animationDelay: `${i * 0.1}s`,
                                      animationDuration: '0.8s'
                                    }}
                                  ></div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={leaveVoiceChannel}
                      className="mt-8 px-6 py-3 bg-red-600 rounded hover:bg-red-500"
                    >
                      Leave Voice Channel
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">Select a channel to start chatting</p>
          </div>
        )}
      </div>

      {/* Панель участников */}
      <div className="w-60 bg-gray-800 p-3 overflow-y-auto">
        <div className="text-gray-400 text-sm font-semibold mb-2">
          ONLINE — {members.length}
        </div>
        
        {members.map((member, index) => {
          const normalizedId = normalizeUUID(member.id);
          const key = normalizedId || `member-${index}`;
          const displayName = member.username || `User-${normalizedId.slice(0,4)}`;
          const isInVoice = voiceUsers.some(u => normalizeUUID(u.id) === normalizedId);

          return (
            <div key={key} className="flex items-center p-2 rounded hover:bg-gray-700">
              <div className="relative">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center mr-2">
                  {displayName.charAt(0)}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                {isInVoice && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-800"></div>
                )}
              </div>
              <div>
                <div className="font-medium">{displayName}</div>
                <div className="text-xs text-gray-400">#{normalizedId.slice(0,4)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Уведомления о голосовой активности */}
      {voiceNotifications.length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2">
          {voiceNotifications.map((notif, index) => {
            const user = userMap[notif.userId] || { username: `User-${notif.userId.slice(0,4)}` };
            return (
              <div 
                key={index} 
                className="bg-gray-800 p-3 rounded-lg shadow-lg flex items-center"
              >
                <div className="mr-2">
                  {notif.action === 'join' ? '🎤' : '🚪'}
                </div>
                <div>
                  <span className="font-bold">{user.username}</span> 
                  {notif.action === 'join' ? ' joined voice' : ' left voice'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ошибки голосового соединения */}
      {voiceError && (
        <div className="fixed bottom-4 left-4 bg-red-600 text-white p-3 rounded">
          Voice Error: {voiceError}
        </div>
      )}

      {/* Модальное окно приглашения пользователя по ID */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Invite User to Server</h3>
            <input
              type="text"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              placeholder="Enter User ID"
              className="w-full p-2 mb-4 bg-gray-700 rounded text-white"
            />
            {inviteError && <p className="text-red-500 text-sm mb-4">{inviteError}</p>}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteError('');
                }}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={inviteUser}
                className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500"
              >
                Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно генерации ссылки приглашения */}
      {isInviteLinkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Invite Link Created</h3>
            <p className="mb-4">Share this link to invite others to the server:</p>
            <div className="flex items-center mb-4">
              <input
                type="text"
                value={invitationLink}
                readOnly
                className="flex-1 p-2 bg-gray-700 rounded text-white mr-2"
              />
              <button
                onClick={() => navigator.clipboard.writeText(invitationLink)}
                className="p-2 bg-gray-600 rounded hover:bg-gray-500"
                title="Copy to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setIsInviteLinkModalOpen(false)}
              className="w-full py-2 bg-indigo-600 rounded hover:bg-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}