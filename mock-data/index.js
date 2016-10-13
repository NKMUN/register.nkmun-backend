const MOCK_COMMITTEE = {
    loc_cn_1: 3,
    loc_cn_2: 0,
    loc_cn_3: 0,
    loc_cn_4: 0,
    loc_cs_1: 1,
    loc_cs_2: 0,
    loc_cs_3: 0,
    loc_en_1: 1,
    loc_en_2: 0,
    loc_en_3: 0,
    loc_en_4: 0,
    loc_en_5: 0,
    loc_media: 1,
    loc_biz: 1,
    loc_link: 1,
    loc_superv: 1,
    loc_observer: 1
}

module.exports = {
    MOCK_ENROLL_ENTRY: {
        id:        'test-school',
        school:    '学校',
        school_en: 'School Name',
        name:      '黑黑黑',
        gender:    'm',
        phone:     '13800000000',
        email:     'darkphoo@example.com',
        'quote_cn':      4,
        'quote_en':      4,
        'quote_press':   4,
        'quote_linkage': 4,
        'quote_superv':  1,
        'quote_observer':1,
        'ac_paper.0': '学术水平测试答案0\n啊啊啊啊啊啊啊啊\n啊啊啊啊啊啊啊',
        'ac_paper.1': '学术水平测试答案1\n啊啊啊啊啊啊啊啊\n啊啊啊啊啊啊啊',
        'ac_paper.2': '学术水平测试答案1\n啊啊啊啊啊啊啊啊\n啊啊啊啊啊啊啊',
        'ac_paper.3': '学术水平测试答案1\n啊啊啊啊啊啊啊啊\n啊啊啊啊啊啊啊',
        committee: MOCK_COMMITTEE
    },
    MOCK_ENROLL_LIST: [
        {
            id: 'test-schoool',
            school: 'test-school',
            quote: 4,
            committee: MOCK_COMMITTEE
        },
        {
            id: 'test-schoool-2',
            school: 'test-school-2',
            quote: 4,
            committee: MOCK_COMMITTEE
        },
        {
            id: 'test-schoool-3',
            school: 'test-school-3',
            quote: 4,
            committee: MOCK_COMMITTEE
        }
    ],
    MOCK_ADMIN_CRED: {
        id:     'mock_admin',
        access: 'admin'
    },
    MOCK_LEADER_CRED: {
        id:     'mock_leader',
        access: 'leader',
        school: 'test-school'
    },
    MOCK_VERIFIED_INVITATION: {
        school:     'test-school',
        invitation: 'abcdefg'
    },
    MOCK_LEADER_CONTACT: {
        name:  'test-leader',
        email: 'test@nkmun.cn'
    },
    MOCK_EXCHANGE_REQUEST_ENTRY: {
        id:   'exchange-id',
        from: 'exchange-offerer',
        to:   'test-school',
        state:  'pending',
        offer:  'loc_cn_1',
        wanted: 'loc_en_1',
        amount: 1
    }
}