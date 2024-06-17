examples = [
    {
        "input_doc":"RedirectMatch 301 ^/part1/part2/$ https://www.example.com/part1/part2/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/part1/part2/</path>
            <regex/>
            <to>https://www.example.com/part1/part2/</to>
            <sc>301</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 302 ^/(.*)/part4/$ https://www.example.com/$1/part4/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/part4</regex>
            <to>https://www.example.com/$1/part4/</to>
            <sc>302</sc>
        """
    },
     {
        "input_doc":"RedirectMatch 302 ^/urlpath1/urlpath2/$ https://www.example.com/part1/part2/",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path>/urlpath1/urlpath2/</path>
            <regex/>
            <to>https://www.example.com/part1/part2/</to>
            <sc>302</sc>
        """
    },
    {
        "input_doc":"RedirectMatch 301 ^/(.*)/part6/part7/(?:\?.*)?$ https://www.example.com/$1/part6/part7/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration",
        "entities_to_extract": ["path","regex","to","sc"],
        "answer": """
            <path/>
            <regex>/(.*)/part6/part7/(?:\?.*)?</regex>
            <to>https://www.example.com/$1/part6/part7/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration</to>
            <sc>301</sc>
        """
    },
    
    # {
    #     "input_doc":"RedirectMatch 301 ^/australia2/(.*)/PRG-US(.*)$ https://www-uat.idp.com/australia2/",
    #     "entities_to_extract": ["path","regex","to","sc"],
    #     "answer": """
    #         <path/>
    #         <regex>/australia2/(.*)/PRG-US(.*)</regex>
    #         <to>https://www-uat.idp.com/australia2/</to>
    #         <sc>301</sc>
    #     """
    # },{
    #     "input_doc":"RedirectMatch 301 ^/(.*)/scholarship/university-east-anglia-international-development-full-fees-scholarship/(?:\?.*)?$ https://www-uat.idp.com/$1/search/scholarship/universities/university-of-east-anglia/iid-uk-00704/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration",
    #     "entities_to_extract": ["path","regex","to","sc"],
    #     "answer": """
    #         <path/>
    #         <regex>/(.*)/scholarship/university-east-anglia-international-development-full-fees-scholarship/(?:\?.*)?</regex>
    #         <to>https://www-uat.idp.com/$1/search/scholarship/universities/university-of-east-anglia/iid-uk-00704/?utm_source=intake&utm_medium=referral&utm_campaign=intake_migration</to>
    #         <sc>301</sc>
    #     """
    # }
]