examples = [
    {
        "input_doc":"RedirectMatch 301 ^/singapore/student-essentials/money-transfer/cohort-go/ca/$ https://www-uat.idp.com/singapore/student-essentials/money-transfer/flywire/ca/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/singapore/student-essentials/money-transfer/cohort-go/ca/</path>
            <regex/>
            <to>https://www-uat.idp.com/singapore/student-essentials/money-transfer/flywire/ca/</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 302 ^/(.*)/register-signin$ https://www-uat.idp.com/$1/user-signup/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/register-signin</regex>
            <to>https://www-uat.idp.com/$1/user-signup/</to>
            <sc>302</sc>
        """
    },{
        "input_doc":"RedirectMatch 301 ^/(.*)/scholarship/academic-excellence-international-masters-scholarship/(?:\?.*)?$ https://www-uat.idp.com/$1/find-a-scholarship/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/scholarship/academic-excellence-international-masters-scholarship/(?:\?.*)?</regex>
            <to>https://www-uat.idp.com/$1/find-a-scholarship/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration</to>
            <sc>301</sc>
        """
    },
     {
        "input_doc":"RedirectMatch 301 ^/australia/student-essentials/money-transfer/cohort-go/faq/nz/$ https://www-uat.idp.com/australia/student-essentials/money-transfer/flywire/faq/nz/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/australia/student-essentials/money-transfer/cohort-go/faq/nz/</path>
            <regex/>
            <to>https://www-uat.idp.com/australia/student-essentials/money-transfer/flywire/faq/nz/</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 301 ^/australia2/(.*)/PRG-US(.*)$ https://www-uat.idp.com/australia2/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/australia2/(.*)/PRG-US(.*)</regex>
            <to>https://www-uat.idp.com/australia2/</to>
            <sc>301</sc>
        """
    },{
        "input_doc":"RedirectMatch 301 ^/(.*)/scholarship/university-east-anglia-international-development-full-fees-scholarship/(?:\?.*)?$ https://www-uat.idp.com/$1/search/scholarship/universities/university-of-east-anglia/iid-uk-00704/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/scholarship/university-east-anglia-international-development-full-fees-scholarship/(?:\?.*)?</regex>
            <to>https://www-uat.idp.com/$1/search/scholarship/universities/university-of-east-anglia/iid-uk-00704/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration</to>
            <sc>301</sc>
        """
    }
]