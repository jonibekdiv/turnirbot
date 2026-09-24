// ============================================================
// KONSTANTALAR — To'liq (barcha funksiyalar + etap tizimi)
// ============================================================
module.exports = {
  // ============================================================
  // ROLLAR
  // ============================================================
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    ORGANIZER: 'organizer',
    HOST: 'host',
    PLAYER: 'player',
  },

  // ============================================================
  // TURNIR TURI
  // ============================================================
  TOURNAMENT_TYPE: {
    FREE: 'free',
    PAID: 'paid',
  },

  // ============================================================
  // TO'LOV STATUSLARI
  // ============================================================
  PAYMENT_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
  },

  // ============================================================
  // KARTA TURLARI
  // ============================================================
  CARD_TYPES: {
    UZCARD: 'uzcard',
    HUMO: 'humo',
    VISA: 'visa',
    MASTERCARD: 'mastercard',
    UNIONPAY: 'unionpay',
    OTHER: 'other',
  },

  CARD_TYPE_LABELS: {
    uzcard: '💳 UzCard',
    humo: '💳 Humo',
    visa: '💳 Visa',
    mastercard: '💳 MasterCard',
    unionpay: '💳 UnionPay',
    other: '💳 Boshqa',
  },

  // ============================================================
  // TURNIR STATUSLARI
  // ============================================================
  TOUR_STATUS: {
    OPEN: 'open',
    FINISHED: 'finished',
    CANCELLED: 'cancelled',
  },

  // ============================================================
  // BRON STATUSLARI
  // ============================================================
  RESERVE_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    EXPIRED: 'expired',
    RELEASED: 'released',
  },

  // ============================================================
  // ETAPLAR TIZIMI — STAGE TYPES
  // ============================================================
  STAGE_TYPE: {
    QUARTER_FINAL: 'quarter_final',
    SEMI_FINAL: 'semi_final',
    FINAL: 'final',
  },

  STAGE_STATUS: {
    PLANNED: 'planned',
    REGISTRATION_OPEN: 'registration_open',
    IN_PROGRESS: 'in_progress',
    WAITING_RESULTS: 'waiting_results',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  STAGE_NAMES: {
    quarter_final: '1/4 Final',
    semi_final: '1/2 Final',
    final: 'Final',
  },

  // ============================================================
  // MATCH NATIJA STATUSLARI
  // ============================================================
  MATCH_RESULT_STATUS: {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  },

  // ============================================================
  // PROMOTION STATUSLARI
  // ============================================================
  PROMOTION_STATUS: {
    QUALIFIED: 'qualified',
    PROMOTED: 'promoted',
    INVITATION_SENT: 'invitation_sent',
    REGISTERED: 'registered',
    REJECTED: 'rejected',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
  },

  // ============================================================
  // INVITATION STATUSLARI
  // ============================================================
  INVITATION_STATUS: {
    CREATED: 'created',
    SENT: 'sent',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
  },

  // ============================================================
  // REMINDER TURLARI
  // ============================================================
  STAGE_REMINDER: {
    H24: '24h',
    H3: '3h',
    H1: '1h',
    M30: '30m',
    M10: '10m',
  },

  // ============================================================
  // DEFAULT BRACKET CONFIG
  // ============================================================
  DEFAULT_BRACKET: {
    quarter_final: {
      numberOfDays: 3,
      matchesPerDay: 1,
      teamsPerMatch: 9,
      qualifiersPerMatch: 3,
    },
    semi_final: {
      numberOfDays: 3,
      matchesPerDay: 1,
      teamsPerMatch: 9,
      qualifiersPerMatch: 3,
    },
    final: {
      numberOfDays: 1,
      matchesPerDay: 1,
      teamsPerMatch: 9,
      qualifiersPerMatch: 0,
    },
  },

  // ============================================================
  // FSM HOLATLARI
  // ============================================================
  STATES: {
    // ---------- Komanda ----------
    TEAM_CREATE_NAME: 'team_create_name',
    TEAM_CREATE_TAG: 'team_create_tag',
    TEAM_CREATE_AVATAR: 'team_create_avatar',
    TEAM_CREATE_MANAGER: 'team_create_manager',
    TEAM_CREATE_CONFIRM: 'team_create_confirm',
    TEAM_JOIN_CODE: 'team_join_code',
    TEAM_EDIT_NAME: 'team_edit_name',
    TEAM_EDIT_TAG: 'team_edit_tag',
    TEAM_EDIT_AVATAR: 'team_edit_avatar',
    TEAM_EDIT_BIO: 'team_edit_bio',
    TEAM_EDIT_MANAGER: 'team_edit_manager',

    // ---------- Turnir yaratish ----------
    TOUR_CREATE_TITLE: 'tour_create_title',
    TOUR_CREATE_TYPE: 'tour_create_type',
    TOUR_CREATE_IMAGE: 'tour_create_image',
    TOUR_CREATE_DATE: 'tour_create_date',
    TOUR_CREATE_TIME: 'tour_create_time',
    TOUR_CREATE_MODE: 'tour_create_mode',
    TOUR_CREATE_PRIZE: 'tour_create_prize',
    TOUR_CREATE_MAP_TAG: 'tour_create_map_tag',
    TOUR_CREATE_ETAPA: 'tour_create_etapa',
    TOUR_CREATE_MAXTEAMS: 'tour_create_maxteams',
    TOUR_CREATE_DESC: 'tour_create_desc',
    TOUR_CREATE_DEADLINE: 'tour_create_deadline',
    TOUR_CREATE_HOST: 'tour_create_host',
    TOUR_CREATE_CONFIRM: 'tour_create_confirm',

    // ---------- Pullik turnir ----------
    TOUR_CREATE_AMOUNT: 'tour_create_amount',
    TOUR_CREATE_CURRENCY: 'tour_create_currency',
    TOUR_CREATE_CARD_NUMBER: 'tour_create_card_number',
    TOUR_CREATE_CARD_OWNER: 'tour_create_card_owner',
    TOUR_CREATE_PAYMENT_INSTR: 'tour_create_payment_instr',
    TOUR_CREATE_PAYMENT_DEADLINE: 'tour_create_payment_deadline',
    TOUR_CREATE_PICK_CARD: 'tour_create_pick_card',

    // ---------- Bepul turnir kanallari ----------
    TOUR_CREATE_CHANNELS: 'tour_create_channels',

    // ---------- Turnir tahrirlash ----------
    TOUR_EDIT_FIELD: 'tour_edit_field',
    TOUR_EDIT_VALUE: 'tour_edit_value',
    TOUR_CLONE_DATE: 'tour_clone_date',
    TOUR_CLONE_TIME: 'tour_clone_time',

    // ---------- Kartalar ----------
    CARD_ADD_NUMBER: 'card_add_number',
    CARD_ADD_OWNER: 'card_add_owner',
    CARD_ADD_PHONE: 'card_add_phone',
    CARD_ADD_TYPE: 'card_add_type',
    CARD_ADD_BANK: 'card_add_bank',
    CARD_ADD_CONFIRM: 'card_add_confirm',

    // ---------- Host ----------
    HOST_SEND_ROOM_ID: 'host_send_room_id',
    HOST_SEND_ROOM_PASS: 'host_send_room_pass',
    HOST_SEND_ROOM_BOTH: 'host_send_room_both',
    HOST_SEND_BROADCAST: 'host_send_broadcast',
    HOST_MATCH_INPUT: 'host_match_input',
    HOST_EDIT_MATCH: 'host_edit_match',
    HOST_PRIZE_INPUT: 'host_prize_input',

    // ---------- Live score ----------
    LIVE_SCORE_INPUT: 'live_score_input',
    LIVE_PLACE_INPUT: 'live_place_input',

    // ---------- O'yinchi ----------
    PLAYER_SEND_TO_HOST: 'player_send_to_host',
    PLAYER_PUBG_ID: 'player_pubg_id',

    // ---------- Obuna ----------
    MEMBER_VERIFY: 'member_verify',

    // ---------- Admin ----------
    ADMIN_ADD_USER_ID: 'admin_add_user_id',
    ADMIN_ADD_ROLE: 'admin_add_role',
    ADMIN_BAN_INPUT: 'admin_ban_input',
    ADMIN_UNBAN_INPUT: 'admin_unban_input',
    ADMIN_DM_USER: 'admin_dm_user',
    ADMIN_DM_MSG: 'admin_dm_msg',
    ADMIN_CHANNEL_INPUT: 'admin_channel_input',
    ADMIN_SETTING_EDIT: 'admin_setting_edit',
    ADMIN_BROADCAST_CUSTOM: 'admin_broadcast_custom',

    // ---------- To'lov ----------
    PAYMENT_RECEIPT: 'payment_receipt',
    PAYMENT_REJECT_REASON: 'payment_reject_reason',

    // ---------- Kanal ----------
    CHANNEL_ADD_INPUT: 'channel_add_input',
    CHANNEL_CUSTOM_TEXT: 'channel_custom_text',
    CHANNEL_CUSTOM_TEXT_BUTTON: 'channel_custom_text_button',
    CHANNEL_CUSTOM_PHOTO: 'channel_custom_photo',
    CHANNEL_CUSTOM_PHOTO_BUTTON: 'channel_custom_photo_button',

    // ---------- Turnir yakunlash ----------
    TOUR_FINISH_CONFIRM: 'tour_finish_confirm',

    // ---------- Kutish ro'yxati ----------
    WAITLIST_JOIN: 'waitlist_join',

    // ---------- Bron ----------
    RESERVE_CONFIRM: 'reserve_confirm',

    // ---------- Qidiruv ----------
    SEARCH_QUERY: 'search_query',

    // ---------- PROMO (A) ----------
    PROMO_CREATE_CODE: 'promo_create_code',
    PROMO_CREATE_PERCENT: 'promo_create_percent',
    PROMO_CREATE_AMOUNT: 'promo_create_amount',
    PROMO_CREATE_MAX_USES: 'promo_create_max_uses',
    PROMO_CREATE_EXPIRES: 'promo_create_expires',
    PROMO_APPLY_INPUT: 'promo_apply_input',

    // ---------- SUPPORT (J) ----------
    SUPPORT_INPUT_TEXT: 'support_input_text',
    SUPPORT_INPUT_ATTACH: 'support_input_attach',
    SUPPORT_ADMIN_REPLY: 'support_admin_reply',

    // ---------- WALLET (L) ----------
    WALLET_DEPOSIT_AMOUNT: 'wallet_deposit_amount',
    WALLET_DEPOSIT_PROOF: 'wallet_deposit_proof',
    WALLET_WITHDRAW_AMOUNT: 'wallet_withdraw_amount',
    WALLET_WITHDRAW_CARD: 'wallet_withdraw_card',
    WALLET_WITHDRAW_OWNER: 'wallet_withdraw_owner',
    WALLET_ADMIN_ADJUST_ID: 'wallet_admin_adjust_id',
    WALLET_ADMIN_ADJUST_AMOUNT: 'wallet_admin_adjust_amount',
    WALLET_ADMIN_ADJUST_REASON: 'wallet_admin_adjust_reason',

    // ============================================================
    // ETAPLAR TIZIMI — STATES
    // ============================================================
    STAGE_SELECT_TOURNAMENT: 'stage_select_tournament',
    STAGE_BRACKET_DAYS_QF: 'stage_bracket_days_qf',
    STAGE_BRACKET_MATCHES_QF: 'stage_bracket_matches_qf',
    STAGE_BRACKET_TEAMS_QF: 'stage_bracket_teams_qf',
    STAGE_BRACKET_QUALIFIERS_QF: 'stage_bracket_qualifiers_qf',
    STAGE_BRACKET_DAYS_SF: 'stage_bracket_days_sf',
    STAGE_BRACKET_MATCHES_SF: 'stage_bracket_matches_sf',
    STAGE_BRACKET_TEAMS_SF: 'stage_bracket_teams_sf',
    STAGE_BRACKET_QUALIFIERS_SF: 'stage_bracket_qualifiers_sf',
    STAGE_BRACKET_DAYS_F: 'stage_bracket_days_f',
    STAGE_BRACKET_MATCHES_F: 'stage_bracket_matches_f',
    STAGE_BRACKET_TEAMS_F: 'stage_bracket_teams_f',

    STAGE_TEAM_DISTRIBUTE_MODE: 'stage_team_distribute_mode',
    STAGE_EDIT_DATE: 'stage_edit_date',
    STAGE_EDIT_TIME: 'stage_edit_time',
    STAGE_EDIT_NAME: 'stage_edit_name',
    STAGE_ASSIGN_HOST_MATCH: 'stage_assign_host_match',
    STAGE_SEND_ROOM_TO_MATCH: 'stage_send_room_to_match',
    STAGE_MATCH_RESULT_INPUT: 'stage_match_result_input',
    STAGE_PROMOTION_CONFIRM: 'stage_promotion_confirm',
    STAGE_DECLINE_REASON: 'stage_decline_reason',
  },

  // ============================================================
  // CALLBACK DATA
  // ============================================================
  CALLBACK: {
    // ---------- Asosiy menyu ----------
    MENU_TOURNAMENTS: 'menu:tournaments',
    MENU_TEAM: 'menu:team',
    MENU_PROFILE: 'menu:profile',
    MENU_HELP: 'menu:help',
    MENU_ADMIN: 'menu:admin',
    MENU_BACK: 'menu:back',
    MENU_MAIN: 'menu:main',
    MENU_LANGUAGE: 'menu:language',

    // ---------- Komanda ----------
    TEAM_CREATE: 'team:create',
    TEAM_JOIN: 'team:join',
    TEAM_MY: 'team:my',
    TEAM_LEAVE: 'team:leave',
    TEAM_CONFIRM: 'team:confirm',
    TEAM_RETRY: 'team:retry',
    TEAM_CANCEL: 'team:cancel',
    TEAM_EDIT: 'team:edit',
    TEAM_EDIT_FIELD: 'team:editf:',
    TEAM_STATS: 'team:stats',
    TEAM_HISTORY: 'team:history',
    TEAM_CAPTAIN_CHANGE: 'team:cc',
    TEAM_CAPTAIN_PICK: 'team:ccp:',
    TEAM_MEMBERS: 'team:members',
    TEAM_KICK: 'team:kick:',
    TEAM_KICK_CONFIRM: 'team:kickc:',

    // ---------- Turnir ----------
    TOUR_LIST: 'tour:list',
    TOUR_TODAY: 'tour:today',
    TOUR_UPCOMING: 'tour:upcoming',
    TOUR_FINISHED: 'tour:finished',
    TOUR_OPEN: 'tour:open:',
    TOUR_REGISTER: 'tour:reg:',
    TOUR_CONTACT_HOST: 'tour:contact_host:',
    TOUR_ROOM_INFO: 'tour:room_info:',
    TOUR_CREATE: 'tour:create',
    TOUR_CONFIRM: 'tour:confirm',
    TOUR_CANCEL: 'tour:cancel',
    TOUR_ASSIGN_HOST: 'tour:ah:',
    TOUR_BROADCAST: 'tour:bc:',
    TOUR_EDIT: 'tour:edit:',
    TOUR_TEAMLIST: 'tour:tl:',
    TOUR_PICK_HOST: 'tour:ph:',
    TOUR_DELETE: 'tour:del:',
    TOUR_DELETE_CONFIRM: 'tour:delc:',
    TOUR_PAGE: 'tour:page:',
    TOUR_STANDINGS: 'tour:st:',
    TOUR_STANDINGS_TEXT: 'tour:st_text:',
    TOUR_CLONE: 'tour:clone:',
    TOUR_CLONE_START: 'tour:clones:',
    TOUR_HISTORY: 'tour:hist',
    TOUR_HISTORY_VIEW: 'tour:hv:',
    TOUR_LINK: 'tour:link:',
    TOUR_STATS: 'tour:stats:',
    TOUR_TEMPLATE: 'tour:tpl',
    TOUR_TEMPLATE_USE: 'tour:tplu:',
    TOUR_TEMPLATE_NEW: 'tour:tpln:',
    TOUR_STAGE: 'tour:stage:',
    TOUR_STAGE_SET: 'tour:stages:',
    TOUR_CALENDAR: 'tour:cal',
    TOUR_CAL_MONTH: 'tour:calm:',
    TOUR_ANNOUNCE: 'tour:anc:',
    TOUR_REPORT: 'tour:rep:',
    TOUR_WINNERS: 'tour:win:',

    // ---------- Turnir turi ----------
    TOUR_TYPE_FREE: 'ttype:free',
    TOUR_TYPE_PAID: 'ttype:paid',
    TOUR_CURRENCY_SET: 'tcurr:',

    // ---------- Bepul turnir kanallari ----------
    TOUR_CH_PICK: 'tch:p:',
    TOUR_CH_DONE: 'tch:done',
    TOUR_CH_SKIP: 'tch:skip',

    // ---------- Karta tanlash ----------
    TOUR_PICK_CARD: 'tpick:',
    TOUR_PICK_CARD_SKIP: 'tpick:skip',
    TOUR_CARD_MANUAL: 'tpick:manual',

    // ---------- Kanal obuna ----------
    CH_VERIFY_ALL: 'chv:all:',
    CH_VERIFY_MEMBER: 'chv:m:',
    CH_SUBSCRIBE: 'chv:sub:',
    CH_BACK: 'chv:back:',

    // ---------- To'lov ----------
    PAY_SEND_RECEIPT: 'pay:send:',
    PAY_CANCEL: 'pay:cancel:',
    PAY_RESEND: 'pay:resend:',
    PAY_MY: 'pay:my',
    PAY_APPROVE: 'pay:a:',
    PAY_REJECT: 'pay:r:',
    PAY_TEAM_INFO: 'pay:ti:',
    PAY_TOUR_INFO: 'pay:tri:',
    PAY_VIEW: 'pay:view:',

    // ---------- Kartalar ----------
    ADMIN_CARDS: 'admin:cards',
    CARD_ADD: 'card:add',
    CARD_LIST: 'card:list',
    CARD_VIEW: 'card:v:',
    CARD_DELETE: 'card:d:',
    CARD_DELETE_CONFIRM: 'card:dc:',
    CARD_SET_DEFAULT: 'card:sd:',
    CARD_TYPE: 'ctype:',

    // ---------- Host ----------
    HOST_TOURS: 'host:tours',
    HOST_OPEN: 'host:open:',
    HOST_ROOM_ID: 'host:rid:',
    HOST_ROOM_PASS: 'host:rpass:',
    HOST_ROOM_BOTH: 'host:rboth:',
    HOST_ROOM_RESEND: 'host:room_resend:',
    HOST_MSG: 'host:msg:',
    HOST_RESULTS: 'host:res:',
    HOST_MATCH_NEW: 'host:mn:',
    HOST_MATCH_CONFIRM: 'host:mc:',
    HOST_MATCH_LIST: 'host:ml:',
    HOST_MATCH_VIEW: 'host:mv:',
    HOST_MATCH_DELETE: 'host:mdel:',
    HOST_MATCH_DEL_CONFIRM: 'host:mdc:',
    HOST_MATCH_EDIT: 'host:me:',
    HOST_STANDINGS: 'host:st:',
    HOST_STANDINGS_TEXT: 'host:st_text:',
    HOST_PRIZE: 'host:pr:',
    HOST_VOICE: 'host:vc:',
    HOST_VIDEO: 'host:vd:',
    HOST_POLL: 'host:pl:',
    HOST_ANNOUNCE_WINNERS: 'host:aw:',

    // ---------- O'yinchi ----------
    USER_PUBG_ID: 'user:pid',
    USER_STATS: 'user:stats',
    USER_ACHIEVEMENTS: 'user:ach',
    USER_LEADERBOARD: 'user:lb',
    USER_LB_MODE: 'user:lbm:',

    // ---------- Admin panel ----------
    ADMIN_PANEL: 'admin:panel',
    ADMIN_USERS: 'admin:users',
    ADMIN_TEAMS: 'admin:teams',
    ADMIN_TOURNAMENTS: 'admin:tournaments',
    ADMIN_HOSTS: 'admin:hosts',
    ADMIN_ADMINS: 'admin:admins',
    ADMIN_ORGS: 'admin:orgs',
    ADMIN_BROADCAST: 'admin:broadcast',
    ADMIN_STATS: 'admin:stats',
    ADMIN_SETTINGS: 'admin:settings',
    ADMIN_ADD_ROLE: 'admin:addrole:',
    ADMIN_DEL_ROLE: 'admin:delrole:',
    ADMIN_PAGE: 'admin:page:',
    ADMIN_BAN: 'admin:ban',
    ADMIN_BAN_CONFIRM: 'admin:banc:',
    ADMIN_UNBAN: 'admin:unban:',
    ADMIN_DM: 'admin:dm:',
    ADMIN_LOGS: 'admin:logs',
    ADMIN_ACTIONS: 'admin:act',
    ADMIN_CHANNEL: 'admin:ch',
    ADMIN_SET_EDIT: 'admin:se:',

    // ---------- To'lov paneli ----------
    ADMIN_PAYMENTS: 'admin:payments',
    ADMIN_PAYMENTS_PENDING: 'admin:pp',
    ADMIN_PAYMENTS_APPROVED: 'admin:pa',
    ADMIN_PAYMENTS_REJECTED: 'admin:pr',

    // ---------- Organizer panel ----------
    ORG_MY_TOURNAMENTS: 'org:mt',
    ORG_MY_PAYMENTS: 'org:mp',
    ORG_PENDING_PAYMENTS: 'org:mpp',

    // ---------- Kanallar ----------
    ADMIN_CHANNELS: 'admin:channels',
    ADMIN_CHANNELS_ADD: 'admin:cha',
    ADMIN_CHANNELS_LIST: 'admin:chl',

    // ---------- Kanal e'lon ----------
    CHANNEL_SET: 'channel:set',
    CHANNEL_CHANGE: 'channel:change',
    CHANNEL_DELETE: 'channel:delete',
    CHANNEL_TEST: 'channel:test',
    CHANNEL_CUSTOM_TEXT: 'channel:custom_text',
    CHANNEL_CUSTOM_PHOTO: 'channel:custom_photo',
    CHANNEL_SEND_NO_BUTTON: 'channel:send_no_button',

    // ---------- Til ----------
    LANG_SET: 'lang:set:',
    LANG_BACK: 'lang:back',

    // ---------- Turnir yakunlash ----------
    TOUR_FINISH: 'tf:finish:',
    TOUR_FINISH_YES: 'tf:yes:',
    TOUR_FINISH_NO: 'tf:no:',
    TOUR_PUBLISH_CHANNEL: 'tf:pub:',

    // ---------- Kutish ro'yxati ----------
    WAITLIST_JOIN: 'wl:join:',
    WAITLIST_LEAVE: 'wl:leave:',
    WAITLIST_VIEW: 'wl:view:',
    WAITLIST_ACCEPT: 'wl:accept:',
    WAITLIST_DECLINE: 'wl:decline:',
    WAITLIST_OWN: 'wl:own',

    // ---------- Guest ----------
    GUEST_VIEW: 'gv:view:',
    GUEST_TOUR: 'gv:tour:',
    GUEST_LIST: 'gv:list',

    // ---------- Komanda statistikasi ----------
    TEAM_STATS_FULL: 'ts:full',
    TEAM_HISTORY_FULL: 'ts:hist',
    TEAM_LEADERBOARD: 'ts:lb',
    TEAM_RANK: 'ts:rank',

    // ---------- Turnir eslatma ----------
    TOUR_REMINDER_VIEW: 'trm:v:',

    // ---------- Reklama statistikasi ----------
    ADMIN_BC_STATS: 'bcs:view',
    ADMIN_BC_STATS_LIST: 'bcs:list',
    ADMIN_BC_STATS_VIEW: 'bcs:v:',

    // ---------- Bron ----------
    RESERVE_START: 'rs:start:',
    RESERVE_OK: 'rs:ok:',
    RESERVE_TIMEOUT: 'rs:timeout:',
    RESERVE_RELEASE: 'rs:release:',
    RESERVE_VIEW: 'rs:view',

    // ---------- Live score ----------
    LIVE_START: 'ls:start:',
    LIVE_ADD: 'ls:add:',
    LIVE_KILL: 'ls:add_k:',
    LIVE_PLACE: 'ls:add_p:',
    LIVE_VIEW: 'ls:view:',
    LIVE_END: 'ls:end:',
    LIVE_PICK_TEAM: 'ls:pick:',

    // ---------- Umumiy ----------
    CANCEL: 'common:cancel',
    NO_ACTION: 'no_action',
    SEARCH_START: 'search:start',
    SEARCH_TOUR: 'search:tour',
    SEARCH_TEAM: 'search:team',
    FILTER_TOUR: 'filter:tour',

    // ---------- PROMO (A) ----------
    PROMO_MENU: 'promo:menu',
    PROMO_LIST: 'promo:list',
    PROMO_CREATE: 'promo:create',
    PROMO_STATS: 'promo:stats',
    PROMO_VIEW: 'promo:v:',
    PROMO_DELETE: 'promo:del:',
    PROMO_DELETE_CONFIRM: 'promo:delc:',
    PROMO_TOGGLE: 'promo:toggle:',
    PROMO_TYPE: 'promo:t:',
    PROMO_APPLY: 'promo:apply:',
    PROMO_SKIP: 'promo:skip:',
    PROMO_REMOVE: 'promo:rm:',

    // ---------- KICK (B) ----------
    TEAM_KICK_LIST: 'team:klist',

    // ---------- SUPPORT (J) ----------
    SUPPORT_START: 'sup:start',
    SUPPORT_TYPE: 'sup:type:',
    SUPPORT_MY: 'sup:my',
    SUPPORT_VIEW: 'sup:v:',
    SUPPORT_ADMIN_LIST: 'sup:alist',
    SUPPORT_ADMIN_NEW: 'sup:anew',
    SUPPORT_ADMIN_ACTIVE: 'sup:aact',
    SUPPORT_ADMIN_CLOSED: 'sup:acl',
    SUPPORT_REPLY: 'sup:reply:',
    SUPPORT_CLOSE: 'sup:close:',
    SUPPORT_CLOSE_CONFIRM: 'sup:cc:',
    SUPPORT_MY_VIEW: 'sup:mv:',

    // ---------- WALLET (L) ----------
    WALLET_VIEW: 'wal:view',
    WALLET_HISTORY: 'wal:hist',
    WALLET_HISTORY_PAGE: 'wal:hp:',
    WALLET_DEPOSIT: 'wal:dep',
    WALLET_WITHDRAW: 'wal:wd',
    WALLET_DEPOSIT_AMOUNT_BTN: 'wal:dpa:',
    WALLET_MY_REQUESTS: 'wal:req',

    WALLET_ADMIN_MENU: 'wal:am',
    WALLET_ADMIN_DEPOSITS: 'wal:adep',
    WALLET_ADMIN_WITHDRAWS: 'wal:awd',
    WALLET_ADMIN_USERS: 'wal:ausr',
    WALLET_ADMIN_USERS_PAGE: 'wal:aup:',
    WALLET_ADMIN_VIEW_USER: 'wal:av:',
    WALLET_ADMIN_ADJUST: 'wal:adj:',
    WALLET_ADMIN_ADJUST_TYPE: 'wal:adjt:',
    WALLET_ADMIN_APPROVE_DEP: 'wal:apd:',
    WALLET_ADMIN_REJECT_DEP: 'wal:rjd:',
    WALLET_ADMIN_APPROVE_WD: 'wal:apw:',
    WALLET_ADMIN_REJECT_WD: 'wal:rjw:',
    WALLET_ADMIN_VIEW_REQ: 'wal:vreq:',
    WALLET_ADMIN_STATS: 'wal:stats',
    WALLET_REQ_CANCEL: 'wal:rcancel:',

    // ============================================================
    // ETAPLAR TIZIMI — CALLBACK
    // ============================================================
    STAGE_MENU: 'stg:menu',
    STAGE_LIST: 'stg:list:',
    STAGE_VIEW: 'stg:view:',
    STAGE_CREATE: 'stg:create:',
    STAGE_BRACKET_SETUP: 'stg:setup:',
    STAGE_BRACKET_STEP: 'stg:step:',
    STAGE_BRACKET_CONFIRM: 'stg:confirm:',
    STAGE_BRACKET_EDIT: 'stg:edit:',
    STAGE_BRACKET_USE_DEFAULT: 'stg:def:',
    STAGE_TEAMS_MENU: 'stg:tm:',
    STAGE_TEAMS_DISTRIBUTE: 'stg:td:',
    STAGE_TEAMS_RANDOM: 'stg:tr:',
    STAGE_TEAMS_RATING: 'stg:trat:',
    STAGE_TEAMS_MANUAL: 'stg:tman:',
    STAGE_TEAMS_ADD: 'stg:ta:',
    STAGE_TEAMS_REMOVE: 'stg:trm:',
    STAGE_MATCHES_LIST: 'stg:ml:',
    STAGE_MATCH_VIEW: 'stg:mv:',
    STAGE_MATCH_EDIT: 'stg:me:',
    STAGE_MATCH_ADD: 'stg:ma:',
    STAGE_MATCH_DELETE: 'stg:md:',
    STAGE_MATCH_HOST_ASSIGN: 'stg:mh:',
    STAGE_MATCH_HOST_SET: 'stg:mhs:',
    STAGE_MATCH_ROOM_SEND: 'stg:mrs:',
    STAGE_MATCH_ROOM_INPUT: 'stg:mri:',
    STAGE_MATCH_RESULTS_INPUT: 'stg:mres:',
    STAGE_MATCH_RESULTS_VIEW: 'stg:mrv:',
    STAGE_RESULTS_SUBMIT: 'stg:rs:',
    STAGE_RESULTS_APPROVE: 'stg:ra:',
    STAGE_RESULTS_REJECT: 'stg:rr:',
    STAGE_RESULTS_REOPEN: 'stg:ro:',
    STAGE_START: 'stg:start:',
    STAGE_FINISH: 'stg:fin:',
    STAGE_CANCEL: 'stg:cancel:',

    // PROMOTION
    PROMOTION_MENU: 'prm:menu',
    PROMOTION_LIST: 'prm:list:',
    PROMOTION_VIEW: 'prm:v:',
    PROMOTION_APPROVE: 'prm:ap:',
    PROMOTION_CANCEL: 'prm:cn:',
    PROMOTION_SEND_INVITE: 'prm:si:',
    PROMOTION_RESEND_INVITE: 'prm:ri:',
    PROMOTION_CONFIRM_ALL: 'prm:ca:',

    // INVITATION
    INV_MY: 'inv:my',
    INV_VIEW: 'inv:v:',
    INV_ACCEPT: 'inv:a:',
    INV_DECLINE: 'inv:d:',
    INV_INFO: 'inv:i:',
    INV_CONTACT_HOST: 'inv:h:',

    // HOST STAGE
    HOST_STAGE_TOURS: 'hst:tours',
    HOST_STAGE_LIST: 'hst:list:',
    HOST_STAGE_MATCH: 'hst:m:',
    HOST_STAGE_RESULTS: 'hst:res:',
    HOST_STAGE_ROOM: 'hst:room:',
    HOST_STAGE_QUALIFIED: 'hst:qf:',

    // REMINDER
    REMINDER_VIEW: 'rmd:v:',
    REMINDER_SEND_NOW: 'rmd:sn:',
  },

  // ============================================================
  // LIMITLAR
  // ============================================================
  LIMITS: {
    MAX_TEAMS_PER_TOURNAMENT: 18,
    MIN_TEAMS_PER_TOURNAMENT: 2,
    MAX_PLAYERS_PER_TEAM: 8,
    MIN_PLAYERS_PER_TEAM: 1,
    MAX_NAME_LEN: 60,
    MAX_DESC_LEN: 400,
    MAX_CAPTION_LEN: 300,
    MAX_PRIZE_LEN: 100,
    MAX_MAP_TAG_LEN: 50,
    MAX_ETAPA_LEN: 30,
    MAX_BIO_LEN: 150,
    MAX_TAG_LEN: 5,
    MAX_PAYMENT_AMOUNT: 999999999,
    MAX_CARD_NUMBER_LEN: 30,
    MAX_CARD_OWNER_LEN: 60,
    MAX_PHONE_LEN: 20,
    MAX_BANK_LEN: 50,
    BROADCAST_DELAY_MS: 60,
    BROADCAST_BATCH: 25,
    PAGE_SIZE: 8,
    TOUR_PAGE_SIZE: 5,
    LOGS_PAGE_SIZE: 20,
    ACTIONS_PAGE_SIZE: 15,

    RESERVE_TIMEOUT_MIN: 5,
    WAITLIST_MAX_PER_TOUR: 30,
    REMINDER_DAY_BEFORE_MIN: 1440,
    REMINDER_HOUR_BEFORE_MIN: 60,

    // Promo
    PROMO_CODE_MIN: 3,
    PROMO_CODE_MAX: 20,
    PROMO_MAX_PERCENT: 100,
    PROMO_MAX_USES_DEFAULT: 100,

    // Wallet
    WALLET_MIN_DEPOSIT: 1000,
    WALLET_MAX_DEPOSIT: 10000000,
    WALLET_MIN_WITHDRAW: 5000,
    WALLET_MAX_WITHDRAW: 5000000,
    WALLET_PAGE_SIZE: 10,

    // Support
    SUPPORT_MAX_ACTIVE: 3,
    SUPPORT_COOLDOWN_MIN: 10,
    SUPPORT_MAX_TEXT: 2000,
    SUPPORT_PAGE_SIZE: 10,

    // ============================================================
    // ETAPLAR TIZIMI
    // ============================================================
    STAGE_MAX_TEAMS_QF: 100,
    STAGE_MAX_DAYS: 30,
    STAGE_MAX_MATCHES_PER_DAY: 20,
    STAGE_MAX_TEAMS_PER_MATCH: 25,
    STAGE_MIN_TEAMS_PER_MATCH: 2,
    STAGE_MAX_QUALIFIERS: 20,
    INVITATION_CODE_LENGTH: 8,
    ROOM_PASSWORD_LENGTH: 6,
    AUDIT_LOG_MAX: 5000,
    PROMOTION_BATCH_SIZE: 10,
  },

  // ============================================================
  // STANDART QIYMATLAR
  // ============================================================
  DEFAULT_MAP: 'Erangel',
  DEFAULT_MODE: 'Squad',
  DEFAULT_MAX_TEAMS: 18,
  DEFAULT_MAX_PLAYERS: 8,
  DEFAULT_LANG: 'uz',
  SUPPORTED_LANGS: ['uz', 'en', 'ru'],

  // ============================================================
  // TILLAR
  // ============================================================
  LANGS: {
    UZ: 'uz',
    RU: 'ru',
    EN: 'en',
  },

  // ============================================================
  // VALYUTALAR
  // ============================================================
  CURRENCIES: ['UZS', 'USD', 'RUB', 'EUR'],

  // ============================================================
  // TEAM LIST SOZLAMALARI
  // ============================================================
  TEAM_LIST: {
    EMPTY_SLOTS: 2,
    START_INDEX: 3,
    RU_TIMEZONE_DIFF: 2,
  },

  // ============================================================
  // PTS TIZIMI
  // ============================================================
  PLACEMENT_POINTS: {
    1: 10,
    2: 6,
    3: 5,
    4: 4,
    5: 3,
    6: 2,
    7: 1,
    8: 1,
  },

  // ============================================================
  // ACHIEVEMENTS
  // ============================================================
  ACHIEVEMENTS: {
    FIRST_BLOOD: { id: 'first_blood', name: '🥇 Birinchi qon', desc: 'Birinchi kill' },
    HUNDRED_KILLS: { id: 'hundred_kills', name: '💯 100 kill', desc: '100 ta kill' },
    FIVE_WINS: { id: 'five_wins', name: "🏆 5 g'alaba", desc: "5 marta 1-o'rin" },
    TEN_MATCHES: { id: 'ten_matches', name: "🎮 10 o'yin", desc: '10 ta kartada qatnashish' },
    CAPTAIN_MASTER: { id: 'captain_master', name: '👑 Captain', desc: "Komanda captain'i" },
    CHICKEN_DINNER: { id: 'chicken_dinner', name: '🍗 Winner Winner', desc: "1-o'rin" },
  },

  // ============================================================
  // TEAM STATUSES
  // ============================================================
  TEAM_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },

  // ============================================================
  // TOURNAMENT STAGES (eski nom — moslik uchun)
  // ============================================================
  STAGES: {
    SINGLE: 'single',
    QUARTER: 'quarter',
    SEMI: 'semi',
    FINAL: 'final',
  },
};